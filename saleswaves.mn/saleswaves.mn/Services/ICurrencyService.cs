using saleswaves.mn.Models;

namespace saleswaves.mn.Services;

public interface ICurrencyService
{
    Task<decimal?> GetExchangeRateAsync(string fromCurrency, string toCurrency);
    Task<decimal?> ConvertCurrencyAsync(decimal amount, string fromCurrency, string toCurrency);
    Task<List<ExchangeRateInfo>> GetMongolbankRatesAsync();
}
