// Windows proxy config to be loaded with the powershell script
// This proxy redirects ALL hytale traffic to our local proxy except for support.hytale.com and maven.hytale.com
// PLEASE DO NOT use the official hytale support for HighElf or any other cracked / private support or questions
// we will get banned. Please use the HighElf github for support and questions.

// If firefox is giving you an https proxy error when going to one of the excluded urls please go to
// about:preferences#general
// scroll all the way down the bottom and click on the Settings... button in Network settings
// at the top in the Configure Proxy Access to the Internet
// select No proxy and click ok
// This will stop firefox from proxying our proxy yo dawg and getting really confused.
function FindProxyForURL(url, host) {
    host = host.toLowerCase();

    if (dnsDomainIs(host, "hytale.com") || shExpMatch(host, "*.hytale.com")) {

        var excluded = ["support", "maven"];
        var parts = host.split(".");
        var prefix = parts.length > 2 ? parts[0] : "";

        // Check if prefix is in excluded array
        for (var i = 0; i < excluded.length; i++) {
            if (excluded[i] === prefix) {
                return "DIRECT";
            }
        }

        return "PROXY 127.0.0.1:8080";
    }

    return "DIRECT";
}
