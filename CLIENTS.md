# HyTale Clients
This is a list of all HyTale clients.
This will give you a list of client build numbers to buildDate-buildHash

## Release patch line
| Build Number | Date Version | ShipOfYarn file | Official Name
| --- | --- | --- | --- |
| 1 | 2026.01.13-dcad8778f | release/windows/v1-windows-amd64.pwr | Early Access Release |
| 2 | 2026.01.13-50e69c385 | release/windows/v2-windows-amd64.pwr | Hotfixes: 13 January 2026 |
| 3 | 2026.01.15-c04fdfe10 | release/windows/v3-windows-amd64.pwr | Hotfixes: 15 January 2026 |
| 4 | 2026.01.17-4b0f30090 | release/windows/v4-windows-amd64.pwr | Update 1 |
| 5 | 2026.01.24-6e2d4fc36 | release/windows/v5-windows-amd64.pwr | Update 2 |
| 6 | 2026.01.27-734d39026 | release/windows/v6-windows-amd64.pwr | Hotfixes: 28 January 2026 |
| 7 | 2026.01.28-87d03be09 | release/windows/v7-windows-amd64.pwr |
| 8 | 2026.02.06-aa1b071c2 | release/windows/v8-windows-amd64.pwr |

Build 2 only boots if you patch build 1 with build 2's patch file correctly.
All other builds seem to work fine clean unpacked to a new folder.

Build 8 does not contain the saving and loading of multiple avatar / skins that are in the pre-release build 18, 19 and 20. Which where all released on the same day.

## Pre-release patch line
| Build Number | Date Version | ShipOfYarn file | Note |
| --- | --- | --- | --- |
| 1 | 2026.01.13-776e44148 | pre-release/windows/v1-windows-amd64.pwr |
| 2 | 2026.01.13-50e69c385 | pre-release/windows/v2-windows-amd64.pwr |
| 3 | 2026.01.14-3e7a0ba6c | pre-release/windows/v3-windows-amd64.pwr |
| 4 | 2026.01.15-c04fdfe10 | pre-release/windows/v4-windows-amd64.pwr | Has the same build hash as release v3 |
| 5 | 2026.01.16-c508b9acd | pre-release/windows/v5-windows-amd64.pwr |
| 6 | 2026.01.16-5d02071f7 | pre-release/windows/v6-windows-amd64.pwr |
| 7 | 2026.01.17-4b0f30090 | pre-release/windows/v7-windows-amd64.pwr | Has the same build hash as release v4 |
| 8 | 2026.01.17-a4cc0e7dd | pre-release/windows/v8-windows-amd64.pwr |
| 9 | 2026.01.22-a60fdd027 | pre-release/windows/v9-windows-amd64.pwr |
| 10 | 2026.01.22-6f8bdbdc4 | pre-release/windows/v10-windows-amd64.pwr |
| 11 | 2026.01.23-d5ecebca9 | pre-release/windows/v11-windows-amd64.pwr |
| 12 | 2026.01.23-6e2d4fc36 | pre-release/windows/v12-windows-amd64.pwr |
| 13 | 2026.01.26-9bf507572 | pre-release/windows/v13-windows-amd64.pwr |
| 14 | 2026.01.26-57a62ca8d | pre-release/windows/v14-windows-amd64.pwr |
| 15 | 2026.01.27-734d39026 | pre-release/windows/v15-windows-amd64.pwr | Same build hash as release v6 |
| 16 | 2026.01.28-87d03be09 | pre-release/windows/v16-windows-amd64.pwr | Same build hash as release v7 |
| 17 | 2026.01.29-301e13929 | pre-release/windows/v17-windows-amd64.pwr |
| 18 | 2026.02.05-bd949ff90 | pre-release/windows/v17~18-windows-amd64.pwr |
| 19 | 2026.02.05-9ce2783f7 | pre-release/windows/v18~19-windows-amd64.pwr |
| 20 | 2026.02.06-0baf7c5aa | pre-release/windows/v19~20-windows-amd64.pwr |
| 21 | 2026.02.11-0235495ee | pre-release/windows/v20~21-windows-amd64.pwr |
| 22 | 2026.02.11-255364b8e | pre-release/windows/v21~22-windows-amd64.pwr |

Please note: While HighElf does support both patch lines, I personally will not be testing all vers of the game
My main focus will be getting the main release vers of the game working. Gives me more time to fix and edit things as needed on a stable build of the game.

Note 2: For any pre-release patches that share the same build numbers as release, HighElf will default to using release data for this client. This may cause issues.

Note 3: It looks like I need to do more research on these build date ver things. As the pre-release vers that share build dates and hashes with release vers have notes on boot telling you that you are running a pre-release ver of the game (except for pre-release build 4)
So the game is different I think, but not sure what is different other then some flags to say this is a pre-release build.
