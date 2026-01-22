using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace saleswaves.mn.Services;

public class CurrencyService : ICurrencyService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;
    private readonly ILogger<CurrencyService> _logger;
    private const string CacheKey = "ExchangeRates";
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
}
