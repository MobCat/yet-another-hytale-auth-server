#!/env/Python3.13.3
#/MobCat (2026)

#Grab data from Assets.zip
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

# Remember to edit this acording to the ver of the game you are extracting data for.
entitlements = {
    'game.base': 0,
    'game.deluxe': 1,
    'game.founder': 2
}
gameVer = 'HytaleClient-2026.01.15-c04fdfe10'

def getBaseEntitlements(editions, entitlements):
    return min(editions, key=lambda x: entitlements.get(x, len(entitlements)))

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