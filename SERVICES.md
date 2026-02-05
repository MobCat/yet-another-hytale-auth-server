# Services documentation
List of HyTale web services HighElf supports
And some info about those services

> [!NOTE]
> This documentation is very placeholder WIP as I build things out
> I'll add more documentation later TM

# sessions.hytale.com/game-session/child
### Status: Incomplete Redirect
### Info:
This services handles auth tokens for joing a game<br>
This api endpoint has been redirected to the auth token node js server emulator by sanasol, edited by MobCat to clean up a few things and add HighElf support.<br>
This is marked as incomplete as to emulate this correctly the token server and HighElf need to communicate some data between each other like session ids and not all of this code is built out yet to do this correctly.<br>
It sorta kinda works, but not correctly.

# sessions.hytale.com/server-join/auth-grant
### Status: Incomplete Redirect
### Info:
This api endpoint has been redirected to the auth token node js server emulator by sanasol, edited by MobCat to clean up a few things and add HighElf support.<br>
This is marked as incomplete as to emulate this correctly the token server and HighElf need to communicate some data between each other like session ids and not all of this code is built out yet to do this correctly.<br>
It sorta kinda works, but not correctly.

# sessions.hytale.com/server-join/auth-token
### Status: Incomplete Redirect
### Info:
This api endpoint has been redirected to the auth token node js server emulator by sanasol, edited by MobCat to clean up a few things and add HighElf support.<br>
This is marked as incomplete as to emulate this correctly the token server and HighElf need to communicate some data between each other like session ids and not all of this code is built out yet to do this correctly.<br>
It sorta kinda works, but not correctly.

# sessions.hytale.com/.well-known/jwks.json
### Status: Incomplete Redirect
### Info:
This api endpoint has been redirected to the auth token node js server emulator by sanasol, edited by MobCat to clean up a few things and add HighElf support.<br>
This service has been modigyed to provide botht public X yet and private D key so the game can sign and valadate JTW tokens to and from the auth server.<br>
TODO: .well-known/get.php a simple script that just copies this json file from the node js auth server to HighElf so we can have a copy.

# sessions.hytale.com/session
### Status: hijacked
### Info:
I don't think this is a real api endpoint for HyTale so we have hijacked it to generate new session tokens or re-generate tokens for existing sessions.

# sentry.hytale.com/api/2/envelope
### Status: Complete?
### Info:
Event ID loopbacked, all other data chucked into the void

# telemetry.hytale.com/telemetry/client
### Status: hijacked
### Info:
This service has been hijacked to help with dev and debugging of HighElf<br>
Any sensitive user data is chucked into the void however we do use this service to<br>
get client build numbers, and to correctly finish and close your game session.<br>
If you go to this api endpoint you will see a `"HighElfDebugLoopback": true` message<br>
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
If the data from the request is not in the loopback, then it was chucked into the void never to be seen again.<br>
If the debug loopback is disabled, then this api will simply return an empty `{}` to signal to the game that this api is "working".<br>
Even know we ignored anything the game sent to us, because we don't need or want your telemetry data.<br>

# account-data.hytale.com/my-account/game-profile
### Status: Complete?
### Info:
On boot of the game client, the game will make a GET request to this api with a Bearer token (aka JWT)
```json
{
  "exp": 1770273375,
  "iat": 1770269775,
  "iss": "https://sessions.hytale.com",
  "jti": "94f20bb3-2dea-48f1-aec4-c0c290c0c659",
  "scope": "hytale:server",
  "sub": "deadbeef-ffff-0000-ffff-123456789abc",
}
```
Side note: If you see `"omni": true` or `"omni": false` in this token as well, it means the HytaleServer.jar has been patched with [omni auth](https://github.com/sanasol/hytale-auth-server/blob/master/patcher/OMNI_AUTH.md)<br>
HighElf will then decode this JWT to get the `sub` aka the users UUID. So we can use this id to lookup user specific data. Said data is then returned to the game client as json like this.
```json
{
    "createdAt": "2026-02-05T05:36:15.000000Z",
    "entitlements": [
        "game.base",
        "game.deluxe",
        "game.founder"
    ],
    "nextNameChangeAt": "2026-02-12T05:36:15.000000Z",
    "skin": "{\"bodyCharacteristic\":\"Default.15\",\"underwear\":\"Suit.Blue\",\"face\":\"Face_Make_Up_2\",\"ears\":\"Default\",\"mouth\":\"Mouth_Cute\",\"haircut\":\"FeatheredHair.BrownSemiLight\",\"facialHair\":null,\"eyebrows\":\"Thin.BrownSemiLight\",\"eyes\":\"Medium_Eyes.Green\",\"pants\":\"Frilly_Skirt.Black\",\"overpants\":null,\"undertop\":\"RibbedLongShirt.Orange\",\"overtop\":\"Tartan.Red\",\"shoes\":\"Trainers.Blue\",\"headAccessory\":\"Pirate_Captain_Hat.BrownDark\",\"faceAccessory\":null,\"earAccessory\":\"DoubleEarrings.Gold_Red.Right\",\"skinFeature\":null,\"gloves\":null,\"cape\":null}",
    "username": "MobCat",
    "uuid": "deadbeef-ffff-0000-ffff-123456789abc"
}
```
Side note: Yes, the skins var is meant to be encoded like this, as it gets decoded by the game somewhere else.<br>
Even know this api sends skins data to the client, and this skin string is also replicated in other JWT tokens, this is separate and different from the skins api, which handles what skins are available, not what skins you have.<br>><br>

This api is marked as complete? as idk if its used for anything else other then loading your avatar on boot, and verifying what entitlements you have so you get access to the right cosmetics in the avatar editor.<br>
for these functions it works grate, but if its referenced or used somewhere else idk yet.


# account-data.hytale.com/my-account/cosmetics
### Status: Spoofed
### Info:
On first load, the client will ask the auth server for a list of cosmetics the user has access to.<br>
for eg. if you have bought the cursebrakers edition, you get all the items. if you have supporter you get some extra items but not all, and if you have standard you get a base set of items.<br>
This service is more or less complete, however I have spoofed what cosmetics the user can have on a server wide / client build bases not per account.<br>
Anyone on the server that has the game.founder entitlement will get the same cursebrakers cosmetics as every other account that has the game.founder entitlement.<br>
However it appears that this service is fully capable to support custom cosmetics per account.<br>
say your HyTale staff and you get custom items. Or you when to an event and got a custom item.<br>
However from my limited testing and data mining, this currently does not seem to be the case. All cosmetics are only tied to the 3 entitlements and it's easier for the server to just load 3 lists, rather then a custom list for every user.<br>
We could easily add a "bonus" items list to account data for custom items, but this would only allow you to add, not remove items.<br>

# account-data.hytale.com/my-account/skin
### Status: Complete?
### Info:

# account-data.hytale.com/my-account/get-launcher-data
### Status: Complete? but also hijacked a little.
### Info:
I think this service is complete. But as HighElf does not support the real launcher, only the game, we don't actually need this service afaik.<br>
However I have built it to emulate what its meant to do afaik. It even supports the auth token so you can get details on your logged in account. This service has support for the following url args<br>
`arch=${arch}&os=${os}`<br>
However as each os only has one arch. the arch url is ignored and you can simply pass just `?os=windows` for eg to get info for windows builds.<br>
Supported os args are.
```
?os=windows
?os=linux
?os=mac
?os=darwin
?os=macos
?os=all
```
all mac flavors have been spoofed to just return darwin for ease of use. So you can use any of them to get "mac" data.<br>
The hijack for this service is a special url arg `os=all` this will give you all supported os, but also all supported builds. See the cosmetics api for more details on build vers.<br>
If no url arg is passed, then this api will default to showing windows build data with a generated fake account.

# sessions.hytale.com/game-session
### Status: Almost complete but guessed at it's functionality.
### Info:
As the game just sends a DELETE request to this api, and the api doesn't even respond I'm more or less guessing at what this does.<br>
My ver of this api endpoint does respond for debug reasons, which I think is fine as the game would never receive the response if one was sent from the real server.<br>
This api seems to be mostly called on game quit and exit to desktop. So if the server did respond, the game is no longer running to get that response.<br>
My ver of this api does respond with a success bool and the string of the session id you just deleted. If you can't find this string in the db, then the session was deleted correctly.<br>
So all my api does is look up your session id and user info to make sure they are valid, and if so we just null the session id token in the accounts database.<br>
A reminder this session id token is also the jti token inside the JWT and is used for both accounts and servers. as we are not emulating the game server auth correctly yet, just client, we don't have to do anything like make sure the game server has stopped and closed if nobody is using it anymore.<br>
Nulling the token out of the database like this may cause issues, mostly with game servers, but i'll figure that out when I get there.<br>
Ideally we would use this DELETE request to go and cleanup any cache, cookies or other active connections for the client that just logged out, but my php ver of this service currently doesn't use or need any of that stuff, we don't really have anything to clean up if the user is no longer logged in.<br><br>

This has been re-evaluated as almost complete for now. Everything game client side appears to be handled and emulated fine, but when you start a new game server (singleplayer or multiplayer) a new session id is made for this server. So other people can join it.<br>
For testing I'm not storing this server session id yet, so this DELETE game-session api does not clean up game server sessions yet. Although I feel like it should though. It will just need a few more checks to make sure nobody else is still in the session before you nuke it.
