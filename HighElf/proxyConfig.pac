// Windows proxy config
function FindProxyForURL(url, host) {
    // Only proxy hytale.com subdomains
    if (shExpMatch(host, "*.hytale.com")) {
        return "PROXY 127.0.0.1:8080";
    }
    // Everything else goes direct
    return "DIRECT";
}