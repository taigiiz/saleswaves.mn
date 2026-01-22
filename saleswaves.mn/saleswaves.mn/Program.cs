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
    // Content Security Policy - Blazor-friendly configuration
    context.Response.Headers.Append("Content-Security-Policy",
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.openstreetmap.org; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: https: blob:; " +
        "font-src 'self' data:; " +
        "connect-src 'self' https://www.mongolbank.mn https://api.exchangerate-api.com wss://* ws://*; " +
        "frame-src https://www.openstreetmap.org; " +
        "frame-ancestors 'none'; " +
        "base-uri 'self'; " +
        "form-action 'self'; " +
        "upgrade-insecure-requests;");

    // Enhanced HSTS (when not in development)
    if (!app.Environment.IsDevelopment())
    {
        context.Response.Headers.Append("Strict-Transport-Security",
            "max-age=31536000; includeSubDomains; preload");
    }

    // X-Content-Type-Options
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");

    // Referrer-Policy
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

    // Permissions-Policy
    context.Response.Headers.Append("Permissions-Policy",
        "geolocation=(), microphone=(), camera=()");

    await next();
});

// Enable response compression (but not for Blazor SignalR)
app.UseWhen(
    context => !context.Request.Path.StartsWithSegments("/_blazor"),
    appBuilder => appBuilder.UseResponseCompression()
);

app.UseHttpsRedirection();

// Configure static files with smart caching
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
    {
        var path = ctx.Context.Request.Path.Value?.ToLower() ?? "";

        // Cache images, fonts, CSS, JS for 1 year
        if (path.EndsWith(".css") || path.EndsWith(".js") ||
            path.EndsWith(".png") || path.EndsWith(".jpg") || path.EndsWith(".jpeg") ||
            path.EndsWith(".gif") || path.EndsWith(".svg") || path.EndsWith(".webp") ||
            path.EndsWith(".woff") || path.EndsWith(".woff2") || path.EndsWith(".ttf") || path.EndsWith(".eot"))
        {
            const int durationInSeconds = 60 * 60 * 24 * 365; // 1 year
            ctx.Context.Response.Headers.Append("Cache-Control", $"public,max-age={durationInSeconds},immutable");
        }
        else
        {
            // For other files, use shorter cache (1 hour)
            const int durationInSeconds = 60 * 60; // 1 hour
            ctx.Context.Response.Headers.Append("Cache-Control", $"public,max-age={durationInSeconds}");
        }
    }
});

app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
