using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;
using saleswaves.mn.Models;
using System.Globalization;

namespace saleswaves.mn.Services;

public class CurrencyService : ICurrencyService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<CurrencyService> _logger;
    private const string CacheKey = "ExchangeRates";
    private const string MongolbankCacheKey = "MongolbankRates";
    private const int CacheExpirationMinutes = 60;

    public CurrencyService(HttpClient httpClient, IMemoryCache cache, ILogger<CurrencyService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    public async Task<decimal?> GetExchangeRateAsync(string fromCurrency, string toCurrency)
    {
        try
        {
            var cacheKey = $"{CacheKey}_{fromCurrency}_{toCurrency}";

            if (_cache.TryGetValue(cacheKey, out decimal cachedRate))
            {
                _logger.LogInformation("Exchange rate retrieved from cache: {From} -> {To}", fromCurrency, toCurrency);
                return cachedRate;
            }

            // Using exchangerate-api.com free tier
            var response = await _httpClient.GetAsync(
                $"https://api.exchangerate-api.com/v4/latest/{fromCurrency}");

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch exchange rates. Status: {Status}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonDocument.Parse(json);

            if (data.RootElement.TryGetProperty("rates", out var rates) &&
                rates.TryGetProperty(toCurrency, out var rate))
            {
                var exchangeRate = rate.GetDecimal();

                // Cache for 1 hour
                _cache.Set(cacheKey, exchangeRate, TimeSpan.FromMinutes(CacheExpirationMinutes));

                _logger.LogInformation("Exchange rate fetched and cached: {From} -> {To} = {Rate}",
                    fromCurrency, toCurrency, exchangeRate);

                return exchangeRate;
            }

            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching exchange rate: {From} -> {To}", fromCurrency, toCurrency);
            return null;
        }
    }

    public async Task<decimal?> ConvertCurrencyAsync(decimal amount, string fromCurrency, string toCurrency)
    {
        var rate = await GetExchangeRateAsync(fromCurrency, toCurrency);
        return rate.HasValue ? amount * rate.Value : null;
    }

    public async Task<List<CurrencyRate>> GetMongolbankRatesAsync()
    {
        try
        {
            if (_cache.TryGetValue(MongolbankCacheKey, out List<CurrencyRate>? cachedRates) && cachedRates != null)
            {
                _logger.LogInformation("Mongolbank rates retrieved from cache");
                return cachedRates;
            }

            // Get yesterday's date (today's rate is actually yesterday's rate)
            var yesterday = DateTime.Now.AddDays(-1);
            var dateString = yesterday.ToString("yyyy-MM-dd");

            var request = new HttpRequestMessage(HttpMethod.Post,
                $"https://www.mongolbank.mn/mn/currency-rates/data?startDate={dateString}&endDate={dateString}");

            request.Headers.Add("Cookie", "language=mn");
            request.Content = new StringContent("", System.Text.Encoding.UTF8, "text/plain");

            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Failed to fetch Mongolbank rates. Status: {Status}", response.StatusCode);
                return new List<CurrencyRate>();
            }

            var json = await response.Content.ReadAsStringAsync();
            var data = JsonSerializer.Deserialize<MongolbankRateResponse>(json);

            if (data?.Success == true && data.Data.Count > 0)
            {
                var rateData = data.Data[0];
                var rates = new List<CurrencyRate>
                {
                    CreateCurrencyRate("USD", "АНУ-ын доллар", "US Dollar", rateData.USD, "🇺🇸"),
                    CreateCurrencyRate("JPY", "Японы иен", "Japanese Yen", rateData.JPY, "🇯🇵"),
                    CreateCurrencyRate("EUR", "Евро", "Euro", rateData.EUR, "🇪🇺"),
                    CreateCurrencyRate("CNY", "БНХАУ-ын юань", "Chinese Yuan", rateData.CNY, "🇨🇳"),
                    CreateCurrencyRate("GBP", "Английн фунт", "British Pound", rateData.GBP, "🇬🇧"),
                    CreateCurrencyRate("KRW", "БНСУ-ын вон", "Korean Won", rateData.KRW, "🇰🇷"),
                    CreateCurrencyRate("RUB", "ОХУ-ын рубль", "Russian Ruble", rateData.RUB, "🇷🇺"),
                    CreateCurrencyRate("KZT", "Казахстаны тэнгэ", "Kazakh Tenge", rateData.KZT, "🇰🇿")
                };

                // Cache for 1 hour
                _cache.Set(MongolbankCacheKey, rates, TimeSpan.FromMinutes(CacheExpirationMinutes));

                _logger.LogInformation("Mongolbank rates fetched and cached successfully");
                return rates;
            }

            return new List<CurrencyRate>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching Mongolbank rates");
            return new List<CurrencyRate>();
        }
    }

    private CurrencyRate CreateCurrencyRate(string code, string name, string nameEn, string rateString, string flag)
    {
        // Parse rate string (e.g., "3,564.01" or "22.45")
        var rate = 0m;
        if (!string.IsNullOrEmpty(rateString))
        {
            var cleanRate = rateString.Replace(",", "");
            decimal.TryParse(cleanRate, NumberStyles.Any, CultureInfo.InvariantCulture, out rate);
        }

        return new CurrencyRate
        {
            Code = code,
            Name = name,
            NameEn = nameEn,
            Rate = rate,
            Flag = flag
        };
    }
}
