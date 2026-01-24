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

# Whats the catch?
Well for fun I wrote as much of this server in PHP as I can. IDK I just like PHP, deal with it.<br>
This server does not support piracy, so how you obtain the game files is up to you, sorry.<br>
Also right now all the user data is sent into an SQLite database. it just makes the dev process easier, it can be sent to a real database in the future once all the data paths have been locked down and are fully known about.

# Why another auth project? whats wrong with the other one/s?
Well outside of the persistent data issues (as in you cant have an account, it just gens new data for you on evrey boot)<br>
This project does not modify the client in any way. (this may be still subject to change if we can't figuer out the keys issue)<br>
But this project proxies all of the games traffic to a new location, our custom server. so from the games point of view, nothing was edited or changed, it thinks its connecting to the real hytale.com. When Infact its connecting to us.<br>
Also please note, as I'm not HyTale staff, some of the staff tools are more or less a guess / what tools I need to admin things. idk if they have any tools on there end, or what they may look like.

# Services List
Click on a service to open its technical details page.
| Service | Support |
| --- | --- |
| sessions.hytale.com/game-session/child | None |
| sessions.hytale.com/server-join/auth-grant | None |
| sessions.hytale.com/server-join/auth-token | None |
| sessions.hytale.com/.well-known/jwks.json | This is just a json file so easy enough to emulate |
| sentry.hytale.com/api/2/envelope | Yes but spoofed your data into the void, I dont want your data |
| telemetry.hytale.com/telemetry/client | Yes but spoofed your data into the void, I dont want your data |
| account-data.hytale.com/my-account/game-profile | Yes |
| account-data.hytale.com/my-account/cosmetics | Yes, but set server wide, not account based. |
| account-data.hytale.com/my-account/skin | Yes |
| account-data.hytale.com/my-account/get-launcher-data | Partial support. Sill WIP |

# Setup: Client side (windows only right now sorry)
1. Download the proxy launcher (this will setup python and mitm-proxy if you dont have them already)
2. Place the launcher at the root of your game files.
3. Edit the proxy config to point to your or someone elses server.
4. Run the proxy launcher, make an account and run the game. thats it.

# Setup: Server side
1. Setup a php server with SQLite and OpenSSL support (I'm just using XAMP for dev)
2. Download and copy the `HighElf` folder to the root of your www folder.
3. Visit /HighElf/admin/setup on your server to setup the server and its configs.
