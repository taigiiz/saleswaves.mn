namespace saleswaves.mn.Models;

public class Vehicle
{
    public int Id { get; set; }
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public int Year { get; set; }
    public decimal PriceJPY { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string Status { get; set; } = "Available"; // Available, InTransit, Sold
    public int Mileage { get; set; }
    public string FuelType { get; set; } = string.Empty;
    public string Transmission { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
}
