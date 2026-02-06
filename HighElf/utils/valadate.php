<?php
// Global helper utiles for doing common tasks
// Saves wright the same functions over and over again.

function valadateClient($pdo){
	// Get all request headers using PHP's built-in function
	$headers = getallheaders();
	//print_r($headers['User-Agent']);
	$stmt = $pdo->prepare("SELECT client FROM approvedClients WHERE client = ? LIMIT 1");
	$stmt->execute([$headers['User-Agent']]);
	$result = $stmt->fetch(PDO::FETCH_ASSOC);
	if ($result == null){die('{"ERROR":"Unauthorized client"}');}
	//print_r($result);

	return str_replace('/','-',$result['client']);

}

function valadateRequestHeadders($pdo){
	$headers = getallheaders();
	//TODO: if $headers['Host'] != our server
	//print_r($headers);

	if (isset($headers['Authorization']) AND preg_match('/Bearer\s+(.+)/i', $headers['Authorization'], $matches)) {
		$jwToken = explode(".", $matches[1]);
		$TokenData = json_decode(base64_decode($jwToken[1]), true); // Just add more json decodes. why not.
		#if ($TokenData['exp'] > time()){
		#	die('{"ERROR":"Token expired"}');
		#}
		//print_r($TokenData['jti']);
		$stmt = $pdo->prepare("SELECT uuid, sessionInit, profileInit, username, entitlements FROM accounts WHERE sessionID = ? LIMIT 1");
		$stmt->execute([$TokenData['jti']]);
		$result = $stmt->fetch(PDO::FETCH_ASSOC);
		if ($result == null){die('{"ERROR":"Unauthorized user"}');}

		return [$TokenData['jti'], $result];

	} 
}

function valadateEntitlements(){

}

// Valdate Authorization / session token
function valadateAuthorization($pdo){
	$headers = getallheaders();

	if (isset($headers['Authorization'])) {
		if (preg_match('/Bearer\s+(.+)/i', $headers['Authorization'], $matches)) {
			$jwToken = explode(".", $matches[1]);
			$TokenData = json_decode(base64_decode($jwToken[1]), true);
			$stmt = $pdo->prepare("SELECT uuid, sessionInit, username, entitlements FROM accounts WHERE sessionID = ? LIMIT 1");
			$stmt->execute([$TokenData['jti']]);
			$result = $stmt->fetch(PDO::FETCH_ASSOC);
			if ($result == null){die('{"ERROR":"Unauthorized Bearer Token"}');}
			//$sessionExpire = $result['sessionInit'] + 2592000; // Default session timeout is 30 days. witch is nuts.
			$sessionExpire = $result['sessionInit'] + 604800;  // ima set it to 7 days for now. TODO: Load from config

			if ($sessionExpire <= $_SERVER['REQUEST_TIME']) {die('{"ERROR":"Session expired"}');}
    	    // Create ISO 8601 timestamps
    	    $dateTime = new DateTime("@{$result['sessionInit']}");
    	    $dateTime->setTimezone(new DateTimeZone('UTC'));
    	    $sessionStart = $dateTime->format('Y-m-d\TH:i:s.u\Z');
    	    
    	    
    	    $dateTime = new DateTime("@$sessionExpire");
    	    $dateTime->setTimezone(new DateTimeZone('UTC'));
    	    $sessionEnd = $dateTime->format('Y-m-d\TH:i:s.u\Z');

			//TODO: add client ip and port checks.
			//print_r($_SERVER['REMOTE_ADDR'] == clients ip address);
			//print_r($_SERVER['REMOTE_PORT'] == 64068);

			//$clientUUID = $result['uuid'];
			//$clientUsername = $result['username'];
			//$clientEntitlements = $result['entitlements'];

			//TODO: valadate entitlements?

			//Return scope so servers can't poke things that are meant for the client and visa versa
			//$scope = mysql_real_escape_string($TokenData['scope']);
			$scope = preg_replace('/[^a-z0-9]/', '', $TokenData['scope']);;

			return [$result['uuid'], $result['username'], $result['entitlements'], $sessionStart, $sessionEnd, $scope];
		}
	} else {
		//TODO: a better error handler
		die('{"ERROR":"Unauthorized client"}');
	}
}

?>