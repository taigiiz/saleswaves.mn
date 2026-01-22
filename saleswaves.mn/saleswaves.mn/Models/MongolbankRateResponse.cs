using System.Text.Json.Serialization;

namespace saleswaves.mn.Models;

public class MongolbankRateResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("data")]
    public List<MongolbankRateData> Data { get; set; } = new();
}

public class MongolbankRateData
{
    [JsonPropertyName("RATE_DATE")]
    public string RateDate { get; set; } = string.Empty;

    [JsonPropertyName("USD")]
    public string USD { get; set; } = string.Empty;

    [JsonPropertyName("EUR")]
    public string EUR { get; set; } = string.Empty;

    [JsonPropertyName("JPY")]
    public string JPY { get; set; } = string.Empty;

    [JsonPropertyName("CHF")]
    public string CHF { get; set; } = string.Empty;

    [JsonPropertyName("SEK")]
    public string SEK { get; set; } = string.Empty;

    [JsonPropertyName("GBP")]
    public string GBP { get; set; } = string.Empty;

    [JsonPropertyName("BGN")]
    public string BGN { get; set; } = string.Empty;

    [JsonPropertyName("HUF")]
    public string HUF { get; set; } = string.Empty;

    [JsonPropertyName("CNY")]
    public string CNY { get; set; } = string.Empty;

    [JsonPropertyName("KRW")]
    public string KRW { get; set; } = string.Empty;

    [JsonPropertyName("RUB")]
    public string RUB { get; set; } = string.Empty;

    [JsonPropertyName("KZT")]
    public string KZT { get; set; } = string.Empty;
}

public class CurrencyRate
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string NameEn { get; set; } = string.Empty;
    public decimal Rate { get; set; }
    public string Flag { get; set; } = string.Empty;
}
