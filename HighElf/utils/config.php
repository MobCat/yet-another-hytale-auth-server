<?php
//silly lil php script.

function getServerConfigs($pdo){
	$stmt = $pdo->prepare("SELECT * FROM serverConfig LIMIT 1");
	$stmt->execute();
	//TODO: probs should check if any data is actualy returned, but fuck it we ball.
	return $stmt->fetch(PDO::FETCH_ASSOC);
}
?>