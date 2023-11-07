// icon-color: green; icon-glyph: battery-half;

/**
 * This widget has been developed by Niklas Vieth.
 * Installation and configuration details can be found at https://github.com/niklasvieth/polestar-ios-lockscreen-widget
 */

// Config
const TIBBER_EMAIL = "<EMAIL_ADDRESS>";
const TIBBER_PASSWORD = "<PASSWORD>";

const TIBBER_BASE_URL = "https://app.tibber.com";
const POLESTAR_ICON = "https://www.polestar.com/w3-assets/coast-228x228.png";

// Check that params are set
if (TIBBER_EMAIL === "<EMAIL_ADDRESS>") {
  throw new Error("Parameter TIBBER_EMAIL is not configured");
}
if (TIBBER_PASSWORD === "<PASSWORD>") {
  throw new Error("Parameter TIBBER_PASSWORD is not configured");
}

// Create Widget
const tibberData = await fetchTibberData();
const percent = tibberData.battery.percent;

const widget = new ListWidget();
widget.url = "polestar-explore://";
const progressStack = await drawArc(widget, percent);

const batteryInfoStack = progressStack.addStack();
batteryInfoStack.layoutVertically();

// Polestar Icon
const imageStack = batteryInfoStack.addStack();
imageStack.addSpacer();
const appIcon = await loadImage(POLESTAR_ICON);
const icon = imageStack.addImage(appIcon);
icon.imageSize = new Size(13, 13);
icon.cornerRadius = 4;
imageStack.addSpacer();

// Percent Text
batteryInfoStack.addSpacer(2);
const textStack = batteryInfoStack.addStack();
textStack.centerAlignContent();
textStack.addSpacer();
textStack.addText(`${percent}%`);
textStack.addSpacer();

widget.presentAccessoryCircular();
Script.setWidget(widget);
Script.complete();

/********************
 * Tibber API helpers
 ********************/
async function fetchTibberToken() {
  const tokenUrl = `${TIBBER_BASE_URL}/login.credentials`;
  const body = {
    "@type": "login",
    email: TIBBER_EMAIL,
    password: TIBBER_PASSWORD,
  };
  const req = new Request(tokenUrl);
  req.method = "POST";
  req.body = JSON.stringify(body);
  req.headers = {
    "Content-Type": "application/json",
    charset: "utf-8",
  };
  const response = await req.loadJSON();
  return response.token;
}

async function fetchTibberData() {
  const tibberToken = await fetchTibberToken();
  const url = `${TIBBER_BASE_URL}/v4/gql`;
  const body = {
    query: "{me{homes{electricVehicles{battery{percent}}}}}",
  };
  const req = new Request(url);
  req.method = "POST";
  req.body = JSON.stringify(body);
  req.headers = {
    "Content-Type": "application/json",
    charset: "utf-8",
    Authorization: `Bearer ${tibberToken}`,
  };
  const response = await req.loadJSON();
  return response.data.me.homes[0].electricVehicles[0];
}

async function loadImage(url) {
  const req = new Request(url);
  return req.loadImage();
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
