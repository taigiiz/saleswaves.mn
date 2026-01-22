namespace saleswaves.mn.Models;

public class Testimonial
{
    public string Name { get; set; } = string.Empty;
    public string Company { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string ImageUrl { get; set; } = string.Empty;
    public int Rating { get; set; } = 5;
    public DateTime Date { get; set; }
}
