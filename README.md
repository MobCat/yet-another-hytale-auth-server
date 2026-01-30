```
▄▄▄   ▄▄▄           ▄▄     ▄▄▄▄▄▄▄ ▄▄   ▄▄ 
███   ███ ▀▀        ██    ███▀▀▀▀▀ ██  ██  
█████████ ██  ▄████ ████▄ ███▄▄    ██ ▀██▀ 
███▀▀▀███ ██  ██ ██ ██ ██ ███      ██  ██  
███   ███ ██▄ ▀████ ██ ██ ▀███████ ██  ██  
                 ██The HyTale auth server
               ▀▀▀ emulator project
```
# HighElf
![icon](https://github.com/user-attachments/assets/e520497b-ebe2-4b17-9a18-ab107fba0575)

HighElf is an authentication server emulator for HyTale<br>
This server aims to do more then just emulate the auth tokens though.<br>
This project has full support for accounts with persistent data, moderator and admin tools, correct versioning and entitlements controls, almost perfect cosmetics support and so much more.<br>
I didn't wanna just spoof some data back to the client to make it boot, I wanted that data to actually be real and useful.

# Roadblock: 2026-01-30
So at this point I can do *evreyhitng* other then start a server / actualy play the game...
It seems that I need to either extract the JWT keys from the games server, or somehow get my own keys into there.
I suck at java dev, and I feel like as soon as I work it out, they will change it / lock it down more.
So for now Ill just stick to making other services and work on what I can

# Whats the catch?
Well for fun I wrote as much of this server in PHP as I can. IDK I just like PHP, deal with it.<br>
This server does not support piracy, so how you obtain the game files is up to you, sorry.<br>
Also right now all the user data is sent into an SQLite database. it just makes the dev process easier, it can be sent to a real database in the future once all the data paths have been locked down and are fully known about.

# Why another auth project? whats wrong with the other one/s?
* Persistent data, you can now save and load accounts. No more random avatars on every boot.
* No need to modify any client files in any way
* Fully divorced the account data server from the sessions server
* Telemetry is optional<br><br>
As account data and session data is now separate, we can all use the one cracked auth token server, but save our own data on our own servers.<br>
You do not need to modify the client or any other game files, we redirect with a proxy.<br>
If your server host chooses not to use telemetry, that data is chucked into the void. Never to be seen again.

# Services List
Click on a service to open its technical details page.
| Service | Support |
| --- | --- |
| [sessions.hytale.com/game-session/child](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sessionshytalecomgame-sessionchild) | Redirected |
| [sessions.hytale.com/server-join/auth-grant](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sessionshytalecomserver-joinauth-grant) | Redirected |
| [sessions.hytale.com/server-join/auth-token](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sessionshytalecomserver-joinauth-token) | Redirected |
| [sessions.hytale.com/.well-known/jwks.json](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sessionshytalecomwell-knownjwksjson) | Redirected |
| [sessions.hytale.com/session](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sessionshytalecomsession) | Hyjacked for cracked launcher |
| [sentry.hytale.com/api/2/envelope](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sentryhytalecomapi2envelope) | Yes event id loopbacked, other data chucked into the void |
| [telemetry.hytale.com/telemetry/client](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#sentryhytalecomapi2envelope) | Yes but spoofed your data into the void, I dont want your data |
| [account-data.hytale.com/my-account/game-profile](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#account-datahytalecommy-accountgame-profile) | Yes |
| [account-data.hytale.com/my-account/cosmetics](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#account-datahytalecommy-accountcosmetics) | Yes, but set server wide, not account based. |
| [account-data.hytale.com/my-account/skin](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#account-datahytalecommy-accountskin) | Yes |
| [account-data.hytale.com/my-account/get-launcher-data](https://github.com/MobCat/yet-another-hytale-auth-server/blob/master/SERVICES.md#account-datahytalecommy-accountget-launcher-data) | Partial support. Sill WIP |

# Setup: Client side (windows only right now sorry)
1. Download the proxy launcher (this will setup python and mitm-proxy if you dont have them already)
2. Place the launcher at the root of your game files.
3. Edit the proxy config to point to your or someone elses server.
4. Run the proxy launcher, make an account and run the game. thats it.

# Setup: Server side
1. Setup a php server with SQLite and OpenSSL support (I'm just using XAMP for dev)
2. Download and copy the `HighElf` folder to the root of your www folder.
3. Visit /HighElf/admin/setup on your server to setup the server and its configs.
