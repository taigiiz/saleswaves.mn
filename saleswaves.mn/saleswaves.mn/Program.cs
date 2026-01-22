using saleswaves.mn.Components;
using saleswaves.mn.Services;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;

var builder = WebApplication.CreateBuilder(args);

// Configure SMTP settings
builder.Services.Configure<SmtpSettings>(
    builder.Configuration.GetSection("SmtpSettings"));

// Register Email Service
builder.Services.AddScoped<IEmailService, EmailService>();

// Register HttpClient for API calls
builder.Services.AddHttpClient<ICurrencyService, CurrencyService>();

// Add Memory Cache for currency rates
builder.Services.AddMemoryCache();

// Add Response Compression for better performance
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "text/css",
        "application/javascript",
        "text/html",
        "application/json",
        "text/plain",
        "text/json"
    });
});

builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.Fastest;
});

builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = CompressionLevel.SmallestSize;
});

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // Enhanced HSTS with preload and includeSubDomains
    app.UseHsts();
}

// Add security headers middleware
app.Use(async (context, next) =>
{
    // Content Security Policy
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.openstreetmap.org; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://www.mongolbank.mn wss: ws:; " +
        "frame-src https://www.openstreetmap.org; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'");

    // Enhanced HSTS (when not in development)
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers.Append("Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload");
    }

    // Cross-Origin-Opener-Policy
    context.Response.Headers.Append("Cross-Origin-Opener-Policy", "same-origin");

    // X-Content-Type-Options
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");

    // X-Frame-Options
    context.Response.Headers.Append("X-Frame-Options", "DENY");

    // Referrer-Policy
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions-Policy
    context.Response.Headers.Append("Permissions-Policy",
        "geolocation=(), microphone=(), camera=()");

    await next();
});

// Enable response compression
app.UseResponseCompression();

app.UseHttpsRedirection();

// Configure static files with caching
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        // Cache static files for 1 year (immutable resources)
        const int durationInSeconds = 60 * 60 * 24 * 365;
        ctx.Context.Response.Headers.Append("Cache-Control", $"public,max-age={durationInSeconds},immutable");
    }
});

app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
