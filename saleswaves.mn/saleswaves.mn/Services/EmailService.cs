using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace saleswaves.mn.Services;

public class EmailService : IEmailService
{
    private readonly SmtpSettings _smtpSettings;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IOptions<SmtpSettings> smtpSettings, ILogger<EmailService> logger)
    {
        _smtpSettings = smtpSettings.Value;
        _logger = logger;
    }

    public async Task<bool> SendContactEmailAsync(string name, string email, string phone, string message)
    {
        try
        {
            using var smtpClient = new SmtpClient(_smtpSettings.Host, _smtpSettings.Port)
            {
                EnableSsl = _smtpSettings.EnableSsl,
                Credentials = new NetworkCredential(_smtpSettings.Username, _smtpSettings.Password)
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_smtpSettings.FromEmail, _smtpSettings.FromName),
                Subject = $"New Contact Form Submission from {name}",
                Body = BuildEmailBody(name, email, phone, message),
                IsBodyHtml = true
            };

            mailMessage.To.Add(_smtpSettings.ToEmail);
            mailMessage.ReplyToList.Add(new MailAddress(email, name));

            await smtpClient.SendMailAsync(mailMessage);

            _logger.LogInformation("Contact email sent successfully from {Email}", email);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send contact email from {Email}", email);
            return false;
        }
    }

    private string BuildEmailBody(string name, string email, string phone, string message)
    {
        return $@"
            <html>
            <body style='font-family: Arial, sans-serif; line-height: 1.6; color: #333;'>
                <div style='max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;'>
                    <h2 style='color: #667eea; margin-bottom: 20px;'>New Contact Form Submission</h2>

                    <div style='background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;'>
                        <p style='margin: 10px 0;'><strong>Name:</strong> {name}</p>
                        <p style='margin: 10px 0;'><strong>Email:</strong> <a href='mailto:{email}'>{email}</a></p>
                        <p style='margin: 10px 0;'><strong>Phone:</strong> {phone}</p>
                    </div>

                    <div style='padding: 15px; border-left: 4px solid #667eea; background: #f8f9fa; margin-top: 20px;'>
                        <p style='margin: 0 0 10px 0;'><strong>Message:</strong></p>
                        <p style='margin: 0; white-space: pre-wrap;'>{message}</p>
                    </div>

                    <hr style='margin: 20px 0; border: none; border-top: 1px solid #ddd;'>

                    <p style='color: #718096; font-size: 14px; margin: 0;'>
                        This email was sent from the Saleswaves.mn contact form.
                    </p>
                </div>
            </body>
            </html>
        ";
    }
}
