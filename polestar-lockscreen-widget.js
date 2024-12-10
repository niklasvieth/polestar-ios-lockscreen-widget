// icon-color: green; icon-glyph: battery-half;

/**
 * This widget has been developed by Niklas Vieth.
 * Installation and configuration details can be found at https://github.com/niklasvieth/polestar-ios-lockscreen-widget
 */

// Config
const POLESTAR_EMAIL = "EMAIL";
const POLESTAR_PASSWORD = "PASSWORD";
let VIN;
// let VIN = "VIN";

// API config
const POLESTAR_BASE_URL = "https://pc-api.polestar.com/eu-north-1";
const POLESTAR_API_URL_V2 = `${POLESTAR_BASE_URL}/mystar-v2`;
const POLESTAR_API_URL = `${POLESTAR_BASE_URL}/my-star`;
const POLESTAR_REDIRECT_URI = "https://www.polestar.com/sign-in-callback";
const POLESTAR_ICON = "https://www.polestar.com/w3-assets/coast-228x228.png";
const CLIENT_ID = "l3oopkc_10";
const CODE_VERIFIER = "polestar-ios-widgets-are-enabled-by-scriptable";
const CODE_CHALLENGE = "adYJTSAVqq6CWBJn7yNdGKwcsmJb8eBewG8WpxnUzaE";

// Check that params are set
if (POLESTAR_EMAIL === "EMAIL_ADDRESS") {
  throw new Error("Parameter POLESTAR_EMAIL is not configured");
}
if (POLESTAR_PASSWORD === "PASSWORD") {
  throw new Error("Parameter POLESTAR_PASSWORD is not configured");
}
if (VIN === "VIN") {
  throw new Error("Parameter VIN is not configured");
}

// Create Widget
const accessToken = await getAccessToken();
const vehicleData = await getVehicles(accessToken);
const batteryData = await getBattery(accessToken);
const batteryPercent = parseInt(batteryData.batteryChargeLevelPercentage);
const isCharging = batteryData.chargingStatus === "CHARGING_STATUS_CHARGING";
const isChargingDone = batteryData.chargingStatus === "CHARGING_STATUS_DONE";
const isConnected =
  batteryData.chargerConnectionStatus === "CHARGER_CONNECTION_STATUS_CONNECTED";

const widget = new ListWidget();
widget.url = "polestar-explore://";
const progressStack = await drawArc(widget, batteryPercent, isCharging);

const batteryInfoStack = progressStack.addStack();
batteryInfoStack.layoutVertically();

// Polestar Icon
const imageStack = batteryInfoStack.addStack();
imageStack.addSpacer();

if (isCharging || isChargingDone) {
  const chargingIcon = isCharging
    ? SFSymbol.named("bolt.fill")
    : SFSymbol.named("checkmark.circle");
  const chargingSymbolElement = imageStack.addImage(chargingIcon.image);
  chargingSymbolElement.tintColor = Color.green();
  chargingSymbolElement.imageSize = new Size(15, 15);
} else if (isConnected) {
  const chargingIcon = SFSymbol.named("bolt.slash.fill");
  const chargingSymbolElement = imageStack.addImage(chargingIcon.image);
  chargingSymbolElement.tintColor = Color.red();
  chargingSymbolElement.imageSize = new Size(15, 15);
} else {
  const appIcon = await loadImage(POLESTAR_ICON);
  const icon = imageStack.addImage(appIcon);
  icon.imageSize = new Size(13, 13);
  icon.cornerRadius = 4;
}
imageStack.addSpacer();

// Percent Text
batteryInfoStack.addSpacer(2);
const textStack = batteryInfoStack.addStack();
textStack.centerAlignContent();
textStack.addSpacer();
textStack.addText(`${batteryPercent}%`);
textStack.addSpacer();

widget.presentAccessoryCircular();
Script.setWidget(widget);
Script.complete();

/**********************
 * Polestar API helpers
 **********************/
async function getAccessToken() {
  const { pathToken, cookie } = await getLoginFlowTokens();
  const tokenRequestCode = await performLogin(pathToken, cookie);
  const apiCreds = await getApiToken(tokenRequestCode);
  return apiCreds.access_token;
}

async function performLogin(pathToken, cookie) {
  const req = new Request(
    `https://polestarid.eu.polestar.com/as/${pathToken}/resume/as/authorization.ping?client_id=${CLIENT_ID}`
  );
  req.method = "post";
  req.body = getUrlEncodedParams({
    "pf.username": POLESTAR_EMAIL,
    "pf.pass": POLESTAR_PASSWORD,
  });
  req.headers = {
    "Content-Type": "application/x-www-form-urlencoded",
    Cookie: cookie,
  };
  req.onRedirect = (redReq) => {
    return null;
  };
  await req.load();
  const redirectUrl = req.response.headers.Location;
  const codeRegex = /code=([^&]+)/;
  let codeMatch = redirectUrl.match(codeRegex);
  const uidRegex = /uid=([^&]+)/;
  const uidMatch = redirectUrl.match(uidRegex);
  if (!codeMatch || codeMatch.length === 0) {
    console.warn("No code found");
    if (uidMatch && uidMatch.length > 0) {
      const uid = uidMatch[1];
      const reqConfirm = new Request(
        `https://polestarid.eu.polestar.com/as/${pathToken}/resume/as/authorization.ping?client_id=${CLIENT_ID}`
      );
      reqConfirm.method = "post";
      reqConfirm.body = getUrlEncodedParams({
        "pf.submit": true,
        subject: uid,
      });
      reqConfirm.headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
      };
      reqConfirm.onRedirect = (redReq) => {
        return null;
      };
      await reqConfirm.load();
      const redirectUrl2 = reqConfirm.response.headers.Location;
      const codeRegex = /code=([^&]+)/;
      codeMatch = redirectUrl2.match(codeRegex);
      if (!codeMatch || codeMatch.length === 0) {
        throw new Error("No token found after confirmation");
      }
    } else {
      throw new Error("Not authenticated, please check login email & password");
    }
  }
  const tokenRequestCode = codeMatch[1];
  return tokenRequestCode;
}

async function getLoginFlowTokens() {
  const params = getUrlEncodedParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: POLESTAR_REDIRECT_URI,
    scope: "openid profile email customer:attributes",
    state: "ea5aa2860f894a9287a4819dd5ada85c",
    code_challenge: CODE_CHALLENGE,
    code_challenge_method: "S256",
  });
  const req = new Request(
    `https://polestarid.eu.polestar.com/as/authorization.oauth2?${params}`
  );
  req.headers = { Cookie: "" };
  let redirectUrl;
  req.onRedirect = (redReq) => {
    redirectUrl = redReq.url;
    return null;
  };
  await req.loadString();
  const regex = /resumePath=(\w+)/;
  const match = redirectUrl.match(regex);
  const pathToken = match ? match[1] : null;
  const cookies = req.response.headers["Set-Cookie"];
  const cookie = cookies.split("; ")[0] + ";";
  return {
    pathToken: pathToken,
    cookie: cookie,
  };
}

async function getApiToken(tokenRequestCode) {
  const req = new Request(`https://polestarid.eu.polestar.com/as/token.oauth2`);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  req.body = getUrlEncodedParams({
    grant_type: "authorization_code",
    code: tokenRequestCode,
    code_verifier: CODE_VERIFIER,
    client_id: CLIENT_ID,
    redirect_uri: POLESTAR_REDIRECT_URI,
  });

  req.onRedirect = (redReq) => {
    return null;
  };
  const apiCreds = await req.loadJSON();
  return {
    access_token: apiCreds.access_token,
    refresh_token: apiCreds.refresh_token,
    expires_in: apiCreds.expires_in,
  };
}

async function getBattery(accessToken) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  const searchParams = {
    query:
      "query GetBatteryData($vin:String!){getBatteryData(vin:$vin){averageEnergyConsumptionKwhPer100Km,batteryChargeLevelPercentage,chargerConnectionStatus,chargingCurrentAmps,chargingPowerWatts,chargingStatus,estimatedChargingTimeMinutesToTargetDistance,estimatedChargingTimeToFullMinutes,estimatedDistanceToEmptyKm,estimatedDistanceToEmptyMiles,eventUpdatedTimestamp{iso,unix}}}",
    variables: {
      vin: VIN,
    },
  };
  const req = new Request(POLESTAR_API_URL_V2);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + accessToken,
  };
  req.body = JSON.stringify(searchParams);
  const response = await req.loadJSON();
  if (!response?.data?.getBatteryData) {
    throw new Error("No battery data fetched");
  }
  const data = response.data.getBatteryData;
  return data;
}

async function getVehicles(accessToken) {
  if (!accessToken) {
    throw new Error("Not authenticated");
  }
  const searchParams = {
    query:
      "query getCars{getConsumerCarsV2{vin,internalVehicleIdentifier,modelYear,content{model{code,name},images,{studio,{url,angles}}},hasPerformancePackage,registrationNo,deliveryDate,currentPlannedDeliveryDate}}",
    variables: {},
  };
  const req = new Request(POLESTAR_API_URL_V2);
  req.method = "POST";
  req.headers = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + accessToken,
  };
  req.body = JSON.stringify(searchParams);
  const response = await req.loadJSON();
  const vehicleData = response?.data?.getConsumerCarsV2;
  if (!vehicleData) {
    throw new Error("No vehicle data fetched");
  }
  const vehicle =
    vehicleData.find((vehicle) => vehicle.vin === VIN) ?? vehicleData[0];
  if (!vehicle) {
    throw new Error(`No vehicle found with VIN ${VIN}`);
  }
  VIN = vehicle.vin;
  return vehicle;
}

async function loadImage(url) {
  const req = new Request(url);
  return req.loadImage();
}

function getUrlEncodedParams(object) {
  return Object.keys(object)
    .map((key) => `${key}=${encodeURIComponent(object[key])}`)
    .join("&");
}

/*****************************
 * Draw battery percent circle
 * Forked and adapted from https://gist.githubusercontent.com/Sillium/4210779bc2d759b494fa60ba4f464bd8/raw/9e172bac0513cc3cf0e70f3399e49d10f5d0589c/ProgressCircleService.js
 *****************************/
async function drawArc(on, percent) {
  const canvSize = 200;
  const canvas = new DrawContext();
  canvas.opaque = false;
  const canvWidth = 18; // circle thickness
  const canvRadius = 80; // circle radius
  canvas.size = new Size(canvSize, canvSize);
  canvas.respectScreenScale = true;

  const deg = Math.floor(percent * 3.6);

  let ctr = new Point(canvSize / 2, canvSize / 2);
  const bgx = ctr.x - canvRadius;
  const bgy = ctr.y - canvRadius;
  const bgd = 2 * canvRadius;
  const bgr = new Rect(bgx, bgy, bgd, bgd);

  canvas.opaque = false;

  canvas.setFillColor(Color.white());
  canvas.setStrokeColor(new Color("#333333"));
  canvas.setLineWidth(canvWidth);
  canvas.strokeEllipse(bgr);

  for (let t = 0; t < deg; t++) {
    const rect_x = ctr.x + canvRadius * sinDeg(t) - canvWidth / 2;
    const rect_y = ctr.y - canvRadius * cosDeg(t) - canvWidth / 2;
    const rect_r = new Rect(rect_x, rect_y, canvWidth, canvWidth);
    canvas.fillEllipse(rect_r);
  }

  let stack = on.addStack();
  stack.size = new Size(65, 65);
  stack.backgroundImage = canvas.getImage();
  let padding = 0;
  stack.setPadding(padding, padding, padding, padding);
  stack.centerAlignContent();

  return stack;
}

function sinDeg(deg) {
  return Math.sin((deg * Math.PI) / 180);
}

function cosDeg(deg) {
  return Math.cos((deg * Math.PI) / 180);
}
