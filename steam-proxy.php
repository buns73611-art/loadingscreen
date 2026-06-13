<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$STEAM_API_KEY = "PUT_YOUR_STEAM_WEB_API_KEY_HERE";
$steamid = isset($_GET["steamid"]) ? preg_replace('/[^0-9]/', '', $_GET["steamid"]) : "";

if (!$steamid || $STEAM_API_KEY === "PUT_YOUR_STEAM_WEB_API_KEY_HERE") {
  http_response_code(400);
  echo json_encode(["error" => "Missing steamid or Steam API key"]);
  exit;
}

$url = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key="
  . urlencode($STEAM_API_KEY)
  . "&steamids="
  . urlencode($steamid);

$response = file_get_contents($url);

if ($response === false) {
  http_response_code(500);
  echo json_encode(["error" => "Steam API request failed"]);
  exit;
}

$data = json_decode($response, true);
$player = $data["response"]["players"][0] ?? null;

if (!$player) {
  http_response_code(404);
  echo json_encode(["error" => "Player not found"]);
  exit;
}

echo json_encode([
  "name" => $player["personaname"] ?? "",
  "avatar" => $player["avatarfull"] ?? ($player["avatarmedium"] ?? "")
]);
?>
