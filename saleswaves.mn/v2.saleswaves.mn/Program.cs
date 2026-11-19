using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.AspNetCore.StaticFiles;
using System.IO.Compression;

// v2.saleswaves.mn — static site host (HTML/CSS/JS + Three.js 3D journey in wwwroot).
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[]
    {
        "text/css",
        "application/javascript",
        "text/javascript",
        "text/html",
        "application/json",
        "image/svg+xml",
        "image/vnd.radiance"
    });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseResponseCompression();

// Security headers
app.Use(async (context, next) =>
{
    var h = context.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["X-Frame-Options"] = "SAMEORIGIN";
    await next();
});

// .hdr (HDRI lighting) is not a default MIME type
var contentTypes = new FileExtensionContentTypeProvider();
contentTypes.Mappings[".hdr"] = "image/vnd.radiance";
contentTypes.Mappings[".webp"] = "image/webp";

app.UseDefaultFiles(); // serves index.html at "/"
app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypes,
    OnPrepareResponse = ctx =>
    {
        var path = ctx.File.Name;
        // HTML always revalidates; versioned assets can be cached longer
        ctx.Context.Response.Headers["Cache-Control"] = path.EndsWith(".html", StringComparison.OrdinalIgnoreCase)
            ? "no-cache"
            : app.Environment.IsDevelopment() ? "no-cache" : "public, max-age=604800";
    }
});

// Unknown routes fall back to the single page
app.MapFallbackToFile("index.html");

app.Run();
