# Services documentation
List of HyTale web services HighElf supports
And some info about those services

> [!NOTE]
> This documentation is very placeholder WIP as I build things out
> I'll add more documentation later TM

# sessions.hytale.com/game-session/child
### Status: Redirected
### Info:
This services handles auth tokens for joing a game
This api endpoint has been redirected to the tokens.js node server.

# sessions.hytale.com/server-join/auth-grant
### Status: Redirected
### Info:
This api endpoint has been redirected to the tokens.js node server.

# sessions.hytale.com/server-join/auth-token
### Status: Redirected
### Info:
This api endpoint has been redirected to the tokens.js node server.

# sessions.hytale.com/.well-known/jwks.json
### Status: Redirected
### Info:
This api endpoint has been redirected to the tokens.js node server.
Sure we could emulate this one on our own server, but its better if the token server handles all of the keys as well.
This way all token gen is divorced from our servar that only handles account data.

# sessions.hytale.com/session
### Status: hijacked
### Info:
I don't think this is a real api endpoint for HyTale so we have hijacked it to generate new session tokens
or re-generate tokens for existing sessions.

# sentry.hytale.com/api/2/envelope
### Status: Complete?
### Info:
Event ID loopbacked, all other data chucked into the void

# telemetry.hytale.com/telemetry/client
### Status: hijacked
### Info:
This service has been hijacked to help with dev and debugging of HighElf
Any sensitive user data is chucked into the void however we do use this service to
get client build numbers, and to correctly finish and close your game session.
If you go to this api endpoint you will see a `"HighElfDebugLoopback": true` message
This means something was read from your telemetry data and used. if we have used any of this data it will look like
```json
{
    "HighElfDebugLoopback": {
        "version": "2026.01.24-6e2d4fc36",
        "revision_id": "6e2d4fc363aaee4de86bef439d67368f6129a336",
        "configuration": "Release",
        "patchline": "release"
    }
}
```
If the data from the request is not in the loopback, then it was chucked into the void never to be seen again.
If the debug loopback is disabled, then this api will simply return an empty `{}` to signal to the game that this api is "working".
Even know we ignored anything the game sent to us, because we don't need or want your telemetry data.

# account-data.hytale.com/my-account/game-profile
### Status: Complete?
### Info:

# account-data.hytale.com/my-account/cosmetics
### Status: Spoofed
### Info:
On first load, the client will ask the auth server for a list of cosmetics the user has access to.
for eg. if you have bought the cursebrakers edition, you get all the items. if you have supporter you get some extra items but not all, and if you have standard you get a base set of items.
This service is more or less complete, however I have spoofed what cosmetics the user can have on a server wide / client build bases not per account.
Anyone on the server that has the game.founder entitlement will get the same cursebrakers cosmetics as every other account that has the game.founder entitlement.
However it appears that this service is fully capable to support custom cosmetics per account.
say your HyTale staff and you get custom items. Or you when to an event and got a custom item.
However from my limited testing and data mining, this currently does not seem to be the case. All cosmetics are only tied to the 3 entitlements and it's easier for the server to just load 3 lists, rather then a custom list for every user.
We could easily add a "bonus" items list to account data for custom items, but this would only allow you to add, not remove items.

# account-data.hytale.com/my-account/skin
### Status: Complete?
### Info:

# account-data.hytale.com/my-account/get-launcher-data
### Status: Complete? but also hijacked a little.
### Info:
I think this service is complete. But as HighElf does not support the real launcher, only the game, we don't actually need this service afaik.
However I have built it to emulate what its meant to do afaik. It even supports the auth token so you can get details on your logged in account. This service has support for the following url args
`arch=${arch}&os=${os}`
However as each os only has one arch. the arch url is ignored and you can simply pass just `?os=windows` for eg to get info for windows builds.
Supported os args are.
```
?os=windows
?os=linux
?os=mac
?os=darwin
?os=macos
?os=all
```
all mac flavors have been spoofed to just return darwin for ease of use. So you can use any of them to get "mac" data.
The hijack for this service is a special url arg `os=all` this will give you all supported os, but also all supported builds. See the cosmetics api for more details on build vers.
If no url arg is passed, then this api will default to showing windows build data with a generated fake account.

# sessions.hytale.com/game-session
### Status: Complete but guessed at it's functionality.
### Info:
As the game just sends a DELETE request to this api, and the api doesn't even respond I'm more or less guessing at what this does.<br>
My ver of this api endpoint does respond for debug reasons, which I think is fine as the game would never receive the response if one was sent from the real server.<br>
This api seems to be mostly called on game quit and exit to desktop. So if the server did respond, the game is no longer running to get that response.<br>
My ver of this api does respond with a success bool and the string of the session id you just deleted. If you can't find this string in the db, then the session was deleted correctly.<br>
So all my api does is look up your session id and user info to make sure they are valid, and if so we just null the session id token in the accounts database.<br>
A reminder this session id token is also the jti token inside the JWT and is used for both accounts and servers. as we are not emulating the game server auth correctly yet, just client, we don't have to do anything like make sure the game server has stopped and closed if nobody is using it anymore.<br>
Nulling the token out of the database like this may cause issues, mostly with game servers, but i'll figure that out when I get there.<br>
Ideally we would use this DELETE request to go and cleanup any cache, cookies or other active connections for the client that just logged out, but my php ver of this service currently doesn't use or need any of that stuff, we don't really have anything to clean up if the user is no longer logged in. 
