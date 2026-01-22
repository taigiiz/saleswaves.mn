using saleswaves.mn.Components;
using saleswaves.mn.Services;

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

// Add services to the container.
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();
app.UseAntiforgery();

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
