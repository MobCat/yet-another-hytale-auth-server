<?php
//Utilities for getting info, from the db mostly.

function getServerConfigs($pdo){
	$stmt = $pdo->prepare("SELECT * FROM serverConfig LIMIT 1");
	$stmt->execute();
	//TODO: probs should check if any data is actualy returned, but fuck it we ball.
	return $stmt->fetch(PDO::FETCH_ASSOC);
}

function getActiveSkin($pdo, $uuid, $serverConfig){ 
	$headers = getallheaders();

	if (isset($headers['Authorization']) AND preg_match('/Bearer\s+(.+)/i', $headers['Authorization'], $matches)) {
		$jwToken = explode(".", $matches[1]);
		$TokenData = json_decode(base64_decode($jwToken[1]), true);

		//$TokenData['sub'] is our account uuid.
		if ($uuid == null) { $uuid = $TokenData['sub']; } //TODO: or $uuid not set.

		$stmt = $pdo->prepare("SELECT * FROM avatars WHERE ownerId = ? ORDER BY lastActive DESC LIMIT 1");
		$stmt->execute([$uuid]);
		$result = $stmt->fetch(PDO::FETCH_ASSOC);

		if ($result == null){
			//Fail safe for no active result found for this client uuid, return something, anything valid.
			$result = [
            	'ownerId' => $uuid,
            	'skinId' => $uuid,
            	'lastActive' => time(),
            	'bodyCharacteristic' => 'Default.15',
            	'underwear' => 'Suit.Blue',
            	'face' => 'Face_Make_Up_2',
            	'ears' => 'Default',
            	'mouth' => 'Mouth_Default',
            	'haircut' => 'FeatheredHair.BrownSemiLight',
            	'facialHair' => null,
            	'eyebrows' => 'Thin.BrownSemiLight',
            	'eyes' => 'Medium_Eyes.Green',
            	'pants' => 'Frilly_Skirt.Black',
            	'overpants' => null,
            	'undertop' => 'RibbedLongShirt.Orange',
            	'overtop' => 'Tartan.Red',
            	'shoes' => 'Trainers.Blue',
            	'headAccessory' => null,
            	'faceAccessory' => null,
            	'earAccessory' => 'DoubleEarrings.Gold_Red.Right',
            	'skinFeature' => null,
            	'gloves' => null,
            	'cape' => null
        	];

		}

		//Fun: if serverConfig['forceHat'] == true
    	//Forces $result['headAccessory'] = Pirate_Captain_Hat.BrownDark
    	//The user can change and reset there hat, but apon load again, they will get a new hat again
    	//Because this is a cracked server, so you gets a pirate hat. its just the rules.
    	if ($serverConfig['forceHat'] == 1){
        	$result['headAccessory'] = 'Pirate_Captain_Hat.BrownDark';
    	}

		return $result;

	}

}
?>