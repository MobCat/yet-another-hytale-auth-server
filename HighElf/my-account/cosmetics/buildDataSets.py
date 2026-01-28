#!/env/Python3.10.4
#/MobCat (2026)

#install\release\package\game\latest\Assets.zip\Cosmetics\CharacterCreator\

import glob
import json
from pathlib import Path

sets = {};

# Lookup dict for the CharacterCreator filenames vs what the game is actualy expecting.
filterNames = {
	'BodyCharacteristics': 'bodyCharacteristic',
	'Capes': 'cape',
	'EarAccessory': 'earAccessory',
	'Ears': 'ears',
	#'Emotes': '', # Not used for auth server
	'Eyebrows': 'eyebrows',
	'EyeColors': 'aa',
	'Eyes': 'eyes',
	'FaceAccessory': 'faceAccessory',
	'Faces': 'face',
	'FacialHair': 'facialHair',
	#'GenericColors': '', # Just a hex color lookup chart
	'Gloves': 'gloves',
	#'GradientSets': '', # More color things evreyone should just have
	#'HairColors': '', # Hex lookup chart with a textuer map
	#'HaircutFallbacks': '', # Failsave for if no custom Haircuts can be found or loaded?
	'Haircuts': 'haircut',
	'HeadAccessory': 'headAccessory',
	'Mouths': 'mouth',
	'Overpants': 'overpants',
	'Overtops': 'overtop',
	'Pants': 'pants',
	'Shoes': 'shoes',
	'SkinFeatures': 'skinFeature', # This object is empty? ima guess tattos / trible markins?
	#'Tags': '', # Something to do with themes and or witch options to show the user first.
	'Undertops': 'undertop',
	'Underwear': 'underwear'
}

# Set these configs FIRST befor running this script. otherwise you will overwrite older configs.
entitlements = {
    'game.base': 0,
    'game.deluxe': 1,
    'game.founder': 2
}
gameVer = 'HytaleClient-2026.01.24-6e2d4fc36'

def getBaseEntitlements(editions, entitlements):
    return min(editions, key=lambda x: entitlements.get(x, len(entitlements)))

if Path('CharacterCreator').is_dir() == False:
	print("ERROR: Please extract the CharacterCreator folder from\ninstall/release/package/game/latest/Assets.zip/Cosmetics/CharacterCreator\nto the root of this folder.\nAlso rememeber you need to run the game first to get its gameVer to add to this scrupt aswell.")
	exit()
	
# Do the things
for file in glob.glob("CharacterCreator/*.json"):
	with open(file) as f:
		d = json.load(f)
		for i in d:
			try:
				elementID = filterNames[Path(file).stem]
				#print(elementID)
				if 'Entitlements' in i:
					#sets[elementID].append(i['Id'])
					#print(i['Entitlements'])
					entitlement = getBaseEntitlements(i['Entitlements'], entitlements)
					#print("\n")
					if entitlement not in sets:
						sets[entitlement] = {}
					sets[entitlement].setdefault(elementID, []).append(i['Id'])
				else:
					# ASSume that if there are not Entitlements set, this cosmetic is for all vers of the game.
					#sets[elementID].append(i['Id'])
					if 'game.base' not in sets:
						sets['game.base'] = {}
					sets['game.base'].setdefault(elementID, []).append(i['Id'])
					#print(i['Id'])
			except KeyError:
				#print(f"WARNING: {Path(file).stem} is not requested by client yet. Skipped.")
				continue # skipped error

for i in entitlements:
	name = f"data/{gameVer}-{i}.json"
	with open(name, "w") as f:
		f.write(json.dumps(sets[i]))
	print(f"saved {name}")

with open(f'data/{gameVer}-weights.json', "w") as f:
	f.write(json.dumps(entitlements))
print(f'saved data/{gameVer}-weights.json')

shutil.rmtree('CharacterCreator')
print("Cleaned up CharacterCreator folder")