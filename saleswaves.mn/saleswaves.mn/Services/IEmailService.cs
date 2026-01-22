namespace saleswaves.mn.Services;

public interface IEmailService
{
    Task<bool> SendContactEmailAsync(string name, string email, string phone, string message);
}
