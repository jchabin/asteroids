var mobile = /Mobi|Android/i.test(navigator.userAgent);

var audioFiles = ["menuintro", "menuloop", "menuexit", "laser", "death", "colld", "musicintro", "musicloop"];
var audio = {};

if(!mobile){
	for(var i = 0; i < audioFiles.length; i++){
		audio[audioFiles[i]] = new Audio(`https://jchabin.github.io/asteroids/${audioFiles[i]}.wav`);
		audio[audioFiles[i]].preservesPitch = false;
		audio[audioFiles[i]].load();
	}
	audio["laser"].volume = 0.5;
	audio["death"].volume = 0.3;
	audio["colld"].volume = 0.75;
}

var firebaseConfig = {
	apiKey: "AIzaSyBMq-qt9oHkZnhwQfxfg9vlD0XCHzl2ZMU",
	authDomain: "asteroids-3564a.firebaseapp.com",
	databaseURL: "https://asteroids-3564a-default-rtdb.firebaseio.com",
	projectId: "asteroids-3564a",
	storageBucket: "asteroids-3564a.appspot.com",
	messagingSenderId: "468345902885",
	appId: "1:468345902885:web:e81ed1fd430ef1b73eaccc",
	measurementId: "G-39JE0967PQ"
}

firebase.initializeApp(firebaseConfig);
firebase.analytics();

var database = firebase.database();

var startCooldown = 750, cooldown = 300, tempI = 1250, blinkSpeed = 12;
var code, me, ref, players = {}, status, numPlayers = 0, c = document.getElementById("c"), SPEED = 0.2, BSPEED = 10, bullets = [], asteroids = [], particles = [], replay = [], replaySpeed, camera, explosions = [];

var debugpoints = [];

function crossZ(a1, b1, a2, b2){
	return a1 * b2 - a2 * b1;
}

function smoothRad(x, y, a1, a2){
	if(x < y)
		return smoothRad(y, x, a2, a1);
	var c = Math.sqrt(x*x + y*y - 2 * x * y * Math.cos(a1 + a2));
	var a = Math.asin(y / c * Math.sin(a1 + a2));
	var m = Math.PI / 2 - a - a1 - a2;
	var b = y * Math.cos(m);
	return b / Math.cos(m + a2);
}

class asteroid{
	constructor(rad, x, y, r, xv, yv, rv){
		this.rad = rad;
		this.x = x;
		this.y = y;
		this.r = r;
		this.xv = xv;
		this.yv = yv;
		this.rv = rv;
		this.points = [];
		var n = Math.floor(Math.random() * 4 + 12);
		for(var i = 0; i < n; i++){
			var r = (Math.random() * 0.5 + 0.75) * rad;
			var a = (Math.random() - 0.5) * 0.1 + i / n * Math.PI * 2;
			this.points.push({
				r: r,
				a: a
			});
		}
		this.color = "white";
		this.push = true;
		this.n = [];
		this.hits = [];
	}
	
	pX(n){
		return this.points[n].r * Math.cos(this.points[n].a + this.r) + this.x;
	}
	
	pY(n){
		return this.points[n].r * Math.sin(this.points[n].a + this.r) + this.y;
	}
	
	draw(ctx){
		ctx.strokeStyle = this.color;
		// if(Math.hypot(this.x - window.innerWidth / 2, this.y - window.innerHeight / 2) < window.innerWidth / 4 + this.rad)
		// 	ctx.strokeStyle = "red";
		ctx.beginPath();
		ctx.moveTo(this.pX(this.points.length - 1), this.pY(this.points.length - 1));
		for(var i = 0; i < this.points.length; i++)
			ctx.lineTo(this.pX(i), this.pY(i));
		ctx.stroke();
	}
	
	c(a){
		var norm = [a.x - this.x, a.y - this.y];
		var angl = Math.atan2(norm[1], norm[0]) - Math.PI * 2;
		while(angl < this.points[0].a + this.r)
			angl += Math.PI * 2;
		var i = 0, n = 0;
		var tL, aL, lA, uA;
		this.n = [];
		while(i < this.points.length - 1 && !(this.points[i].a + this.r == angl || (this.points[i].a + this.r < angl && this.points[i + 1].a + this.r > angl)))
			i++;
		if(i < this.points.length - 1){
			lA = this.points[i].a + this.r;
			uA = this.points[i + 1].a + this.r;
			
			// this.n[0] = [
			// 	-(this.pY(i) - this.pY(i + 1)),
			// 	(this.pX(i) - this.pX(i + 1)),
			// 	Math.abs((angl - lA) - 0.5 * (uA - lA))
			// ];
			// tL = (angl - lA) / (uA - lA);
			// tL = (1 - tL) * this.points[i].r + (tL) * this.points[i + 1].r;
			tL = smoothRad(this.points[i].r, this.points[i + 1].r, angl - lA, uA - angl);
		}else{
			lA = this.points[i].a + this.r;
			uA = this.points[0].a + Math.PI * 2 + this.r;
			
			// this.n[0] = [
			// 	-(this.pY(i) - this.pY(0)),
			// 	(this.pX(i) - this.pX(0)),
			// 	Math.abs((angl - lA) - 0.5 * (uA - lA))
			// ];
			// tL = (angl - lA) / (uA - lA);
			// tL = (1 - tL) * this.points[i].r + (tL) * this.points[0].r;
			tL = smoothRad(this.points[i].r, this.points[0].r, angl - lA, uA - angl);
			// if(
			// 	tL > Math.max(this.points[i].r, this.points[0].r)
			// 	|| tL < Math.min(this.points[i].r, this.points[0].r)
			// )
			// 	debugger;
		}
		
		angl -= Math.PI * 5;
		while(angl < a.points[0].a + a.r)
			angl += Math.PI * 2;
		
		while(n < a.points.length - 1 && !(a.points[n].a + a.r == angl || (a.points[n].a + a.r < angl && a.points[n + 1].a + a.r > angl)))
			n++;
		if(n < a.points.length - 1){
			lA = a.points[n].a + a.r;
			uA = a.points[n + 1].a + a.r;
			
			// this.n[1] = [
			// 	(a.pY(n) - a.pY(n + 1)),
			// 	-(a.pX(n) - a.pX(n + 1)),
			// 	Math.abs((angl - lA) - 0.5 * (uA - lA))
			// ];
			// aL = (angl - lA) / (uA - lA);
			// aL = (1 - aL) * a.points[n].r + (aL) * a.points[n + 1].r;
			aL = smoothRad(a.points[n].r, a.points[n + 1].r, angl - lA, uA - angl);
		}else{
			lA = a.points[n].a + a.r;
			uA = a.points[0].a + Math.PI * 2 + a.r;
			
			// this.n[1] = [
			// 	(a.pY(n) - a.pY(0)),
			// 	-(a.pX(n) - a.pX(0)),
			// 	Math.abs((angl - lA) - 0.5 * (uA - lA))
			// ];
			// aL = (angl - lA) / (uA - lA);
			// aL = (1 - aL) * a.points[n].r + (aL) * a.points[0].r;
			aL = smoothRad(a.points[n].r, a.points[0].r, angl - lA, uA - angl);
		}
		
		// var l1 = Math.hypot(this.n[0][0], this.n[0][1]);
		// var l2 = Math.hypot(this.n[1][0], this.n[1][1]);
		// // this.n = this.n[0][2] < this.n[1][2] ? this.n[0] : this.n[1];
		// if((this.n[0][0] * norm[0] + this.n[0][1] * norm[1]) / l1 > (this.n[1][0] * norm[0] + this.n[1][1] * norm[1]) / l2){
		// 	this.n = this.n[0];
		// 	debugpoints.push([Math.cos(angl + Math.PI) * tL + this.x, Math.sin(angl + Math.PI) * tL + this.y]);
		// 	debugpoints.push([Math.cos(angl + Math.PI) * tL + this.x + this.n[0], Math.sin(angl + Math.PI) * tL + this.y + this.n[1]]);
		// }else{
		// 	this.n = this.n[1];
		// 	debugpoints.push([Math.cos(angl) * aL + a.x, Math.sin(angl) * aL + a.y]);
		// 	debugpoints.push([Math.cos(angl) * aL + a.x + this.n[0], Math.sin(angl) * aL + a.y + this.n[1]]);
		// }
		
		// debugpoints.push([Math.cos(angl) * aL + a.x, Math.sin(angl) * aL + a.y]);
		
		return Math.hypot(norm[0], norm[1]) - tL - aL;
	}
	
	move(ast, ctx, n){
		var hit = false;
		this.hits = [];
		for(var i = n + 1; i < ast.length; i++)
			if(ast[i] != this){
				var a = ast[i];
				// if(Math.hypot(this.x - a.x, this.y - a.y) < this.rad + a.rad){
				var overl = this.c(a)
				if(overl < 0){
					hit = true;
					// this.color = "red";
					var p = [
						this.x * (a.rad) / (this.rad + a.rad) + a.x * (this.rad) / (this.rad + a.rad),
						this.y * (a.rad) / (this.rad + a.rad) + a.y * (this.rad) / (this.rad + a.rad)
					];
					var norm = [a.x - this.x, a.y - this.y];
					var l = Math.hypot(norm[0], norm[1]);
					norm = [norm[0] / l, norm[1] / l];
					
					
					
					// var tNorm = this.n;
					// var l = Math.hypot(tNorm[0], tNorm[1]);
					// tNorm = [tNorm[0] / l, tNorm[1] / l];
					
					// console.log(tNorm);
					
					var angl = Math.atan2(norm[1], norm[0]);
					var tSp = [
						this.xv - Math.sin(angl) * this.rv * this.rad,
						this.yv + Math.cos(angl) * this.rv * this.rad
					];
					var tAp = [
						a.xv + Math.sin(angl) * a.rv * a.rad,
						a.yv - Math.cos(angl) * a.rv * a.rad
					];
					// if(norm[0] * tNorm[0] + norm[1] * tNorm[1] < 0){
					// 	tNorm = [-tNorm[0], -tNorm[1]];
					// 	debugger;
					// }
					
					// if(norm[0] * tNorm[0] + norm[1] * tNorm[1] < 0.25){
					// 	debugger;
					// }
					// // tNorm = [-tNorm[0], -tNorm[1]];
					// console.log(norm[0] * tNorm[0] + norm[1] * tNorm[1]);
					// // norm = [-norm[0], -norm[1]];
					// norm = tNorm;
					
					var mT = this.rad * this.rad, mA = a.rad * a.rad;
					var d = (tAp[0] - tSp[0]) * norm[0] + (tAp[1] - tSp[1]) * norm[1];
					if(d > 0){
						this.x += norm[0] * overl * mA / (mT + mA);
						this.y += norm[1] * overl * mA / (mT + mA);
						
						a.x -= norm[0] * overl * mT / (mT + mA);
						a.y -= norm[1] * overl * mT / (mT + mA);
						
						continue;
					}
					
					this.hits.push(a);
					
					// debugger;
					var n = [norm[0] * d, norm[1] * d];
					var f = [
						(tAp[0] - tSp[0]) - n[0],
						(tAp[1] - tSp[1]) - n[1]
					];
					var mm = 1.4;
					n[0] *= mm; n[1] *= mm;
					
					var fl = Math.hypot(f[0], f[1]);
					
					n[0] += f[0] / fl * Math.min(fl, 0.01);
					n[1] += f[1] / fl * Math.min(fl, 0.01);
					
					var nn = [n[0] * mA / (mT + mA), n[1] * mA / (mT + mA)];
					this.rv += crossZ(p[0] - this.x, p[1] - this.y, nn[0], nn[1]) / this.rad;
					this.xv = tSp[0] + nn[0] + Math.sin(angl) * this.rv * this.rad;
					this.yv = tSp[1] + nn[1] - Math.cos(angl) * this.rv * this.rad;
					
					nn = [-n[0] * mT / (mT + mA), -n[1] * mT / (mT + mA)];
					a.rv += crossZ(p[0] - a.x, p[1] - a.y, nn[0], nn[1]) / a.rad;
					a.xv = tAp[0] + nn[0] - Math.sin(angl) * a.rv * a.rad;
					a.yv = tAp[1] + nn[1] + Math.cos(angl) * a.rv * a.rad;
					
					if(this.push && a.push){
						this.x += norm[0] * overl * mA / (mT + mA);
						this.y += norm[1] * overl * mA / (mT + mA);
						
						a.x -= norm[0] * overl * mT / (mT + mA);
						a.y -= norm[1] * overl * mT / (mT + mA);
					}
				}
			}
		this.x += this.xv;
		this.y += this.yv;
		this.r += this.rv;
		
		if(this.r > Math.PI * 2)
			this.r -= Math.PI * 2;
		if(this.r < 0)
			this.r += Math.PI * 2;
		return hit;
	}
	
	colliding(ast){
		for(var i = 0; i < ast.length; i++)
			if(ast[i] != this)
				if(this.c(ast[i]) < 0)
					return true;
		return false;
	}
}

class particle{
	constructor(x, y, r, s, rv, c, g){
		this.x = x; this.y = y;
		this.r = r; this.s = s;
		this.rv=rv; this.c = c;
		this.g = g;
	}
}

function flipPage(n){
	var f = document.getElementsByClassName("page _1"), i = 1;
	while(f.length > 0){
		f[0].style.top = 100 * (i++ - n) + "vh";
		f = document.getElementsByClassName("page _" + i);
	}
}

if(mobile){
	document.getElementById("desktop").style.display = "none";
	if(localStorage.getItem("code")){
		document.getElementById("codeinp").value = localStorage.getItem("code");
		localStorage.removeItem("code")
		joinCode(document.getElementById("codeinp"));
	}
}else{
	//desktop version
	document.getElementById("mobile").style.display = "none";
	const cLetters = "ABCDEFGHJKMNOPQRSTUVWXYZ";
	var specificGameFailed = false;
	function tryCode(){
		var ccc = localStorage.getItem("code");
		if(ccc && !specificGameFailed){
			code = ccc;
			specificGameFailed = true;
		}else{
			code = "";
			for(var i = 0; i < 4; i++)
				code += cLetters[Math.floor(Math.random() * cLetters.length)];
		}
		ref = database.ref(code);
		console.log(code);
		ref.once("value", function(e){
			if(e.val() == null || typeof e.val() == "undefined" || e.val().status == 3){
				status = 1;
				document.getElementById("code").innerHTML = code;
				ref.set({
					status: status,
					players: [],
					bullets: []
				});
				database.ref(code + "/players").on("child_added", function(e){
					var di = document.createElement("DIV");
					di.className = "player";
					document.getElementById("players").appendChild(di);
					players[e.ref_.path.pieces_[2]] = {
						data: e.val(),
						element: di,
						pos: {
							x: 0, y: 0, r: 0,
							xv: 0, yv: 0
						}
					}
					if(++numPlayers >= 2)
						document.getElementById("start").className = "ready";
					onchange(e);
				});
				function onchange(e){
					players[e.ref_.path.pieces_[2]].data = e.val();
					if(status == 1){
						var p = players[e.ref_.path.pieces_[2]];
						p.element.style.color = "hsl(" + p.data.color + ", 100%, 50%)";
						p.element.style.borderColor = p.element.style.color;
						p.element.innerText = p.data.name;
						p.element.className = p.data.status == 0 ? "player ready" : "player";
					}
				}
				database.ref(code + "/players").on("child_changed", onchange);
				database.ref(code + "/bullets").on("child_added", function(e){
					bullets.push(e.val());
					e.ref_.remove();
				});
			}else
				tryCode();
		});
	}
	// tryCode();
}

var cR;
function joinCode(e){
	e.style.borderColor = "white";
	e.value = e.value.toUpperCase();
	e.value = e.value.replace(/[\d\W_]/g, "");
	if(e.value.length > 4)
		e.value = e.value.substring(0, 4);
	if(e.value.length == 4){
		code = e.value;
		ref = database.ref(code);
		cR = Date.now();
		var eR = cR;
		ref.once("value", function(n){
			if(eR != cR)
				return;
			console.log(n.val());
			if(n.val() && n.val().status == 1){
				console.log("yeap", code);
				e.oninput = undefined;
				e.blur();
				me = {
					ref: database.ref(code + "/players").push(),
					data: {
						status: -1,
						mov: {x: 0, y: 0},
						color: Math.floor(Math.random() * 360),
						name: "-"
					}
				}
				me.ref.set(me.data);
				wheelD = 360 - me.data.color;
				flipPage(2);
				var st = database.ref(code);
				st.on("value", function(e){
					if(e.val().status == 2){
						st.off();
						document.getElementById("nameinp").blur();
						wheelR = false;
						cWheel.ontouchmove = cWheel.ontouchstart = undefined;
						startPlayer();
						
						st = database.ref(code);
						st.on("value", function(e){
							if(e.val().status == 3)
								reload();
						});
					}
				});
			}else if(n.val() && n.val().status == 3)
				joinCode(e);
			else{
				console.log("nope", code);
				e.style.borderColor = "#f33";
			}
		});
	}
}

function setName(e){
	e.value = e.value.toUpperCase();
	e.value = e.value.replace(/[^\w\!\?\(\)\%\[\]\{\}\@\&\/\\\:\;\<\>\*\-]/g, "");
	if(e.value.length > 3)
		e.value = e.value.substring(0, 3);
	me.data.name = (e.value == "" ? "-" : e.value);
	me.ref.set(me.data);
}

function submitName(){
	me.ref.set(me.data);
	flipPage(3);
	animateWheel()
}

var cWheel = document.getElementById("colorwheel");
var cGrad = "conic-gradient(";
for(var i = 0; i < 360; i += 30)
	cGrad += "hsl(" + i + ", 100%, 50%) " + i + "deg, ";
cGrad += "hsl(360, 100%, 50%) 360deg)";
cWheel.style.background = cGrad;

var wheelR = true;
var wheelV = 0;
var wheelD = 0;
var anLt = -1;
function animateWheel(){
	var warp = anLt == -1 ? 0 : (Date.now() - anLt) / 1000;
	anLt = Date.now();
	if(wheelR)
		requestAnimationFrame(animateWheel);
	wheelD += wheelV * warp;
	wheelD = wheelD < 0 ? wheelD + 360 : wheelD > 360 ? wheelD - 360 : wheelD;
	wheelV *= Math.pow(0.5, warp);
	cWheel.style.transform = "rotate(" + wheelD + "deg)";
	me.data.color = Math.floor(360 - wheelD);
	document.getElementById("colPreview").style.background = "hsl(" + me.data.color + ", 100%, 50%)";
	me.ref.set(me.data);
}

var lx = 0, ly = 0, lt = 0;
cWheel.ontouchstart = function(e){
	lx = e.touches[0].clientX;
	ly = e.touches[0].clientY;
	lt = Date.now();
	wheelV = 0;
}
cWheel.onmousedown = function(e){
	lt = Date.now();
	wheelV = 0;
}
cWheel.ontouchmove = function(e){
	cWheel.onmousemove({
		clientX: e.touches[0].clientX,
		clientY: e.touches[0].clientY,
		movementX: e.touches[0].clientX - lx,
		movementY: e.touches[0].clientY - ly
	});
	lx = e.touches[0].clientX;
	ly = e.touches[0].clientY;
}
cWheel.onmousemove = function(e){
	var a1 = Math.atan2(
		e.clientY - e.movementY - window.innerHeight,
		e.clientX - e.movementX - window.innerWidth / 2
	) * 180 / Math.PI;
	var a2 = Math.atan2(
		e.clientY - window.innerHeight,
		e.clientX - window.innerWidth / 2
	) * 180 / Math.PI;
	var dA = a2 - a1;
	var d = Date.now();
	dA = dA > 180 ? dA - 360 : dA < -180 ? dA + 360 : dA;
	if(isNaN(dA) || d == lt){
		lt = d;
		return;
	}
	wheelV = dA / (d - lt) * 1000;
	lt = d;
}

function submitColor(){
	flipPage(4);
	wheelR = false;
	me.data.status = 0;
	me.ref.set(me.data);
}

function rotPoint(x, y, r){
	var c = Math.cos(r), s = Math.sin(r);
	return [
		c * x - s * y,
		s * x + c * y
	];
}

function fakePlayer(){
	var p = {
		status: 0,
		mov: {x: 0, y: 0},
		color: Math.floor(Math.random() * 360),
		name: "AAA"
	}
	database.ref(code + "/players").push().set(p);
}

function nextGame(){
	var winplayer;
	for(var i in players)
		if((players[i].score >= modeVal || (players[i].score > 0 && selectedMode == 2)) && (!winplayer || players[winplayer].score < players[i].score))
			winplayer = i;
	
	if(winplayer){
		document.getElementById("winscreen").style.top = 0;
		document.getElementById("wwname").innerHTML = players[winplayer].data.name;
		document.getElementById("winscreen").style.background = "hsl(" + players[winplayer].data.color + ", 100%, 50%)";
		document.getElementById("wwname").style.color = "hsl(" + players[winplayer].data.color + ", 100%, 50%)";
		return;
	}
	
	var sc = document.getElementById("scores");
	sc.style.top = 0;
	// sc = sc.firstChild;
	sc.children[0].innerHTML = "";
	for(var i in players){
		var p = players[i];
		var d = document.createElement("DIV");
		d.className = "scorecard";
		d.innerHTML = "<p class='scorename' style='color: " + "hsl(" + p.data.color + ", 100%, 50%)" + "'>" + p.data.name + "</p>" + p.score;
		sc.children[0].appendChild(d);
	}
	
	setTimeout(function(){
		sc.style.top = "-100vh";
		startGame();
	}, 3300);
	
	var ba = document.getElementById("bar");
	var lo = document.getElementById("loader");
	
	lo.replaceChild(ba.cloneNode(), ba);
}

function createGame(){
	tryCode();
	document.getElementById("overlay").className = "";
	document.getElementById("create").onclick = undefined;
	function playMenuLoop(){
		if(status != '1')
			return;
		audio["menuloop"].currentTime = 0;
		audio["menuloop"].play();
		setTimeout(playMenuLoop, 60 * 1000 / 150 * 16 * 4 - 100);
	}
	audio["menuintro"].play();
	setTimeout(playMenuLoop, 60 * 1000 / 150 * 16 - 100);
	
	for(var i = 1; i < audioFiles.length; i++){
		let la = audio[audioFiles[i]];
		if(la.readyState < 3){
			la.oncanplay = function(e){
				la.pause();
				console.log(la);
				la.oncanplay = undefined;
				la.currentTime = 0;
			}
			la.play();
		}
	}
}

function stopMusicThenStartGame(){
	document.getElementById("start").onclick = undefined;
	setTimeout(function(){
		audio["menuintro"].pause();
		audio["menuloop"].pause();
	}, 50);
	audio["menuexit"].play();
	status = 2;
	setTimeout(startGame, 500);
}

function startGame(){
	document.getElementById("desktop").style.top = "-100vh";
	setTimeout(function(){
		document.getElementById("desktop").style.display = "none";
	}, 300);
	
	asteroids = [];
	bullets = [];
	particles = [];
	explosions = [];
	
	status = 2;
	database.ref(code + "/status").set(status);
	
	var c = document.getElementById("c");
	
	var height = window.innerHeight;
	var width = window.innerWidth;
	c.height = height;
	c.width = width;
	
	var ctx = c.getContext("2d");
	
	for(var i = 0; i < 14; i++){
		var ass = new asteroid(
			Math.pow(Math.random(), 2) * 100 + 10,
			(Math.random() * 2 - 0.5) * width,
			(Math.random() * 2 - 0.5) * height,
			Math.random() * 2 * Math.PI,
			(Math.random() - 0.5) * 3,
			(Math.random() - 0.5) * 3,
			(Math.random() - 0.5) * 0.04
		);
		if(Math.hypot(ass.x - width / 2, ass.y - height / 2) < height / 4 + ass.rad || ass.colliding(asteroids))
			i--;
		else
			asteroids.push(ass);
	}
	
	var collider = new asteroid(20, 0, 0, 0, 0, 0, 0);
	collider.points = [
		{a: 0, r: 5},
		{a: Math.PI / 2, r: 5},
		{a: Math.PI, r: 5},
		{a: Math.PI * 3 / 2, r: 5}
	];
	collider.push = false;
	
	var c = 0;
	for(var i in players){
		var p = players[i];
		var r = c++ / numPlayers * 2 * Math.PI;
		var dist = width / 32 + width / 16 * Math.random();
		p.pos.x = dist * Math.cos(r) + width / 2;
		p.pos.y = dist * Math.sin(r) + height / 2;
		p.pos.r = r;
		p.pos.xv = 0;
		p.pos.yv = 0;
		p.dead = false;
		if(selectedMode == 2)
			p.lives = modeVal;
		if(!p.score)
			p.score = 0;
		var label = document.createElement("DIV");
		label.innerHTML = p.data.name;
		label.style.left = p.pos.x + "px";
		label.style.top  = p.pos.y + "px";
		label.className = "label";
		document.body.appendChild(label);
		setTimeout(function(l){
			document.body.removeChild(l);
		}, 1300 + 500 * Math.random(), label);
	}
	
	var alivePlayers = numPlayers;
	
	replay = [];
	
	var deathFrames = 32;
	
	var paused = true;
	var freezeFrame = 0;
	
	setTimeout(function(){
		if(audio["musicintro"].paused && audio["musicloop"].paused){
			setTimeout(function(){
				function playBGLoop(){
					audio["musicloop"].currentTime = 0;
					audio["musicloop"].play();
					setTimeout(playBGLoop, (60 * 1000) / 200 * 16 * 24 - 100);
				}
				playBGLoop();
			}, (60 * 1000) / 200 * 16 * 2 - 100);
			audio["musicintro"].play();
		}
	}, 250);
	
	setTimeout(function(){
		var cou = document.createElement("DIV");
		cou.className = "countdown";
		cou.innerHTML = "3";
		document.body.appendChild(cou);
		setTimeout(function(){
			document.body.removeChild(cou);
		}, 1000);
	}, 250);
	
	setTimeout(function(){
		var cou = document.createElement("DIV");
		cou.className = "countdown";
		cou.innerHTML = "2";
		document.body.appendChild(cou);
		setTimeout(function(){
			document.body.removeChild(cou);
		}, 1000);
	}, 850);
	
	setTimeout(function(){
		var cou = document.createElement("DIV");
		cou.className = "countdown";
		cou.innerHTML = "1";
		document.body.appendChild(cou);
		setTimeout(function(){
			document.body.removeChild(cou);
		}, 1000);
	}, 1450);
	
	setTimeout(function(){
		paused = false;
		for(var i in players)
			players[i].cooldown = Date.now() + startCooldown;
	}, 1800);
	
	var mScore = 0;
	
	var frameNum = 0;
	function update(){
		if(freezeFrame > 0){
			requestAnimationFrame(update);
			freezeFrame -= 0.5;
			ctx.globalCompositeOperation = "difference";
			for(var i = 0; i < explosions.length; i++){
				ctx.fillStyle = "white";
				ctx.beginPath();
				ctx.arc(explosions[i].x, explosions[i].y, 16 + 32 * Math.random(), 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.globalCompositeOperation = "source-over";
			return;
		}
		if((alivePlayers > 1 && (selectedMode != 1 || mScore < modeVal)) || deathFrames-- > 0)
			requestAnimationFrame(update);
		else{
			setTimeout(function(){
				document.getElementById("winner").style.bottom = "-100vh";
				showReplay();
			}, 800);
		}
		if(deathFrames == 31){
			var winner;
			if(selectedMode == 1 && alivePlayers > 1){
				for(var i in players)
					if(!players[i].score >= mScore)
						winner = players[i];
			}else
				for(var i in players)
					if(!players[i].dead)
						winner = players[i];
			if(!winner)
				debugger;
			if(selectedMode == 0 || selectedMode == 2)
				winner.score++;
			document.getElementById("wname").style.setProperty("--outline", "hsl(" + winner.data.color + ", 100%, 50%)");
			document.getElementById("wname").innerHTML = winner.data.name;
			document.getElementById("winner").style.bottom = 0;
		}
		if(deathFrames == 16)
			document.getElementById("winner").style.bottom = 0;
		
		var rdata = {
			explosions: JSON.stringify(explosions)
		}
		
		explosions = [];
		
		// ctx.clearRect(0, 0, width, height)
		ctx.fillStyle = "black";
		ctx.globalAlpha = 0.5;
		ctx.fillRect(0, 0, width, height);
		ctx.globalAlpha = 1;
		
		// ctx.fillStyle = "#111";
		// ctx.beginPath();
		// ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
		// ctx.fill();
		
		for(var i in players){
			p = players[i];
			mScore = Math.max(mScore, p.score);
			
			if(p.dead)
				continue;
			if(!p.data.mov)
				continue;
			
			if(paused){
				p.data.mov.x = 0;
				p.data.mov.y = 0;
			}
			
			if(p.data.mov.x != 0 || p.data.mov.y != 0)
				p.pos.r = Math.atan2(p.data.mov.y, p.data.mov.x);
			var p1 = rotPoint(10, 0, p.pos.r);
			var p2 = rotPoint(-5, 5, p.pos.r);
			var p3 = rotPoint(-5, -5, p.pos.r);
			
			var invc = p.invc && (p.invc > Date.now());
			
			ctx.lineWidth = 3;
			ctx.strokeStyle = (invc && frameNum % blinkSpeed < blinkSpeed / 2) ? "white" : ("hsl(" + p.data.color + ", 100%, 50%)");
			ctx.beginPath();
			ctx.moveTo(p.pos.x + p1[0], p.pos.y + p1[1]);
			ctx.lineTo(p.pos.x + p2[0], p.pos.y + p2[1]);
			ctx.lineTo(p.pos.x + p3[0], p.pos.y + p3[1]);
			ctx.lineTo(p.pos.x + p1[0], p.pos.y + p1[1]);
			ctx.stroke();
			
			p.data.mov.x *= 0.98;
			p.data.mov.y *= 0.98;
			
			p.pos.xv += p.data.mov.x * SPEED;
			p.pos.yv += p.data.mov.y * SPEED;
			
			p.pos.xv *= 0.98;
			p.pos.yv *= 0.98;
			
			p.pos.x += p.pos.xv;
			p.pos.y += p.pos.yv;
			
			if(p.pos.x < 7){
				p.pos.x = 7;
				p.pos.xv = Math.abs(p.pos.xv);
			}
			
			if(p.pos.y < 7){
				p.pos.y = 7;
				p.pos.yv = Math.abs(p.pos.yv);
			}
			
			if(p.pos.x > width - 7){
				p.pos.x = width - 7;
				p.pos.xv = -Math.abs(p.pos.xv);
			}
			
			if(p.pos.y > height - 7){
				p.pos.y = height - 7;
				p.pos.yv = -Math.abs(p.pos.yv);
			}
			
			collider.x = p.pos.x; collider.y = p.pos.y;
			collider.xv = p.pos.xv;
			collider.yv = p.pos.yv;
			collider.rv = 0; collider.r = 0;
			
			if(collider.move(asteroids, ctx, -1)){
				var dir = Math.atan2(collider.yv, collider.xv);
				var len = Math.hypot(collider.yv, collider.xv);
				
				p.pos.xv = collider.xv, p.pos.yv = collider.yv;
				if(invc)
					continue;
				
				for(var n = 0; n < 35; n++){
					particles.push(new particle(
						p.pos.x,
						p.pos.y,
						dir,
						len * (1 + 1.3 * (Math.random() - 0.5)) + Math.random(),
						(Math.random() - 0.5) * 0.2 * (0.5 + Math.min(1 / len, 5)),
						Math.random() > 0.5 ? "white" : "hsl(" + p.data.color + ", 100%, 50%)",
						1 + Math.random()
					));
				}
				
				var dd = audio["death"].cloneNode();
				dd.playbackRate = 1 + (Math.random() - 0.5) * 0.2;
				dd.volume = audio["death"].volume;
				dd.play();
				
				for(var n = 0; n < collider.hits.length; n++)
					collider.hits[n].blame = i;
				
				freezeFrame = 1;
				
				
				if(selectedMode == 2 && --p.lives > 0){
					p.invc = Date.now() + tempI;
					continue;
				}
				
				p.dead = true;
				alivePlayers--;
				
				if(selectedMode == 1 && collider.hits && collider.hits[0].blame && collider.hits[0].blame != i)
					players[collider.hits[0].blame].score++;
				
				continue;
			}
			
			for(var n = 0; n < bullets.length; n++){
				if(bullets[n].s != i && (typeof bullets[n].x != "undefined") && Math.hypot(bullets[n].x - p.pos.x, bullets[n].y - p.pos.y) < 12){
					var dir = bullets[n].r;
					var len = BSPEED;
					
					p.pos.xv += Math.cos(dir) * BSPEED; p.pos.yv += Math.sin(dir) * BSPEED;
					if(invc)
						continue;
					
					for(var j = 0; j < 35 + 15; j++){
						particles.push(new particle(
							p.pos.x,
							p.pos.y,
							dir,
							len * (1 + 1.3 * (Math.random() - 0.5)) + Math.random(),
							(Math.random() - 0.5) * 0.2 * (0.5 + Math.min(1 / len, 5)),
							Math.random() > 0.2 ? Math.random() > 0.5 ? "white" : "hsl(" + p.data.color + ", 100%, 50%)" : "hsl(" + players[bullets[n].s].data.color + ", 100%, 50%)",
							1 + Math.random()
						));
					}
					
					freezeFrame = 1;
					
					var dd = audio["death"].cloneNode();
					dd.playbackRate = 1 + (Math.random() - 0.5) * 0.2;
					dd.volume = audio["death"].volume;
					dd.play();
					
					if(selectedMode == 2 && --p.lives > 0){
						p.invc = Date.now() + tempI;
						continue;
					}
					
					p.dead = true;
					alivePlayers--;
					
					if(selectedMode == 1)
						players[bullets[n].s].score++;
					
					bullets.splice(n, 1);
					continue;
				}
			}
		}
		
		for(var i = 0; i < bullets.length; i++){
			if(paused){
				bullets.splice(i--, 1);
				continue;
			}
			b = bullets[i];
			if(typeof b.x == "undefined"){
				if(Date.now() < players[b.s].cooldown || players[b.s].dead){
					bullets.splice(i--, 1);
					continue;
				}
				players[b.s].cooldown = Date.now() + cooldown;
				b.x = players[b.s].pos.x;
				b.y = players[b.s].pos.y;
				b.r = players[b.s].pos.r;
				
				var dd = audio["laser"].cloneNode();
				dd.playbackRate = 1 - Math.random() * 0.2;
				dd.volume = audio["laser"].volume;
				dd.play();
			}
			ctx.strokeStyle = "hsl(" + players[b.s].data.color + ", 100%, 50%)";
			ctx.beginPath();
			ctx.moveTo(b.x, b.y);
			b.x += Math.cos(b.r) * BSPEED;
			b.y += Math.sin(b.r) * BSPEED;
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
			
			collider.x = b.x; collider.y = b.y;
			collider.xv = Math.cos(b.r) * BSPEED;
			collider.yv = Math.sin(b.r) * BSPEED;
			collider.rv = 0; collider.r = 0;
			
			if(collider.move(asteroids, ctx, -1)){
				var dir = Math.atan2(collider.yv, collider.xv);
				var len = Math.hypot(collider.yv, collider.xv);
				for(var n = 0; n < 15; n++){
					particles.push(new particle(
						b.x,
						b.y,
						dir,
						len * (1 + 0.8 * (Math.random() - 0.5)) * 1,
						(Math.random() - 0.5) * 0.2 * (0.2 + Math.min(1 / len, 5)),
						"hsl(" + players[b.s].data.color + ", 100%, 50%)",
						1 + Math.random()
					));
				}
				bullets.splice(i--, 1);
				var dd = audio["colld"].cloneNode();
				dd.playbackRate = 1 + (Math.random() - 0.5) * 0.2;
				dd.volume = audio["colld"].volume;
				dd.play();
			}else if(b.x < 0 || b.x > width || b.y < 0 || b.y > height)
				bullets.splice(i--, 1);
		}
		
		for(var i = 0; i < asteroids.length; i++){
			var a = asteroids[i];
			if(!paused)
				a.move(asteroids, ctx, i);
			a.draw(ctx);
			if(a.x < -2 * a.rad)
				a.x = width + 2 * a.rad;
			if(a.y < -2 * a.rad)
				a.y = height + 2 * a.rad;
			if(a.x > width + 2 * a.rad)
				a.x = -2 * a.rad;
			if(a.y > height + 2 * a.rad)
				a.y = -2 * a.rad;
		}
		
		for(var i = 0; i < particles.length; i++){
			var p = particles[i];
			p.x += Math.cos(p.r) * p.s;
			p.y += Math.sin(p.r) * p.s;
			p.r += p.rv;
			
			ctx.globalAlpha = Math.min(p.g, 1);
			ctx.fillStyle = p.c;
			ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
			ctx.globalAlpha = 1;
			
			p.s *= 0.98;
			p.rv *= 0.98;
			p.g *= 0.98;
			
			if(p.g < 0.01)
				particles.splice(i--, 1);
		}
		
		ctx.strokeStyle = "yellow";
		for(var i = 0; i < debugpoints.length; i += 2){
			var d = debugpoints[i];
			var d2 = debugpoints[i + 1];
			ctx.beginPath()
			ctx.moveTo(d[0], d[1]);
			ctx.lineTo(d2[0], d2[1]);
			ctx.stroke();
		}
		
		debugpoints = [];
		if(!paused){
			rdata.players = JSON.stringify(players);
			rdata.bullets = JSON.stringify(bullets);
			rdata.asteroids = JSON.stringify(asteroids);
			rdata.particles = JSON.stringify(particles);
			
			replay.push(rdata);
			if(replay.length > 16 * 6)
				replay.splice(0, 1);
		}
		
		frameNum++;
	}
	update();
	
	var frame = 0;
	var f = replay[0];
	
	replaySpeed = 4;
	
	camera = {
		x: width / 2,
		y: height / 2,
		scale: 1
	}
	
	function showReplay(){
		if(frame < replay.length * replaySpeed)
			requestAnimationFrame(showReplay);
		else{
			requestAnimationFrame(nextGame);
			return;
		}
		ctx.resetTransform();
		ctx.fillStyle = "black";
		ctx.globalAlpha = 0.5;
		ctx.fillRect(0, 0, width, height);
		ctx.globalAlpha = 1;
		
		
		
		ctx.translate(-camera.x * camera.scale + width / 2, -camera.y * camera.scale + height / 2);
		ctx.scale(camera.scale, camera.scale);
		
		// console.log(camera);
		
		if(frame % replaySpeed == 0)
			f = {
				players: JSON.parse(replay[frame / replaySpeed].players),
				bullets: JSON.parse(replay[frame / replaySpeed].bullets),
				asteroids: JSON.parse(replay[frame / replaySpeed].asteroids),
				particles: JSON.parse(replay[frame / replaySpeed].particles),
				explosions: JSON.parse(replay[frame / replaySpeed].explosions)
			}
		
		var lPlayers = [];
		for(var i in f.players){
			p = f.players[i];
			if(p.dead)
				continue;
			if(!p.data.mov)
				continue;
			if(p.data.mov.x != 0 || p.data.mov.y != 0)
				p.pos.r = Math.atan2(p.data.mov.y, p.data.mov.x);
			var p1 = rotPoint(10, 0, p.pos.r);
			var p2 = rotPoint(-5, 5, p.pos.r);
			var p3 = rotPoint(-5, -5, p.pos.r);
			
			var invc = p.invc && (p.invc > Date.now());
			
			ctx.lineWidth = 3;
			ctx.strokeStyle = (invc && (frame / replaySpeed) % blinkSpeed < blinkSpeed / 2) ? "white" : ("hsl(" + p.data.color + ", 100%, 50%)");
			ctx.beginPath();
			ctx.moveTo(p.pos.x + p1[0], p.pos.y + p1[1]);
			ctx.lineTo(p.pos.x + p2[0], p.pos.y + p2[1]);
			ctx.lineTo(p.pos.x + p3[0], p.pos.y + p3[1]);
			ctx.lineTo(p.pos.x + p1[0], p.pos.y + p1[1]);
			ctx.stroke();
			
			lPlayers.push({x: p.pos.x, y: p.pos.y});
			
			if(frame % replaySpeed == 0)
				continue;
			
			p.data.mov.x *= Math.pow(0.98, (1 / replaySpeed));
			p.data.mov.y *= Math.pow(0.98, (1 / replaySpeed));
			
			p.pos.xv += (1 / replaySpeed) * p.data.mov.x * SPEED;
			p.pos.yv += (1 / replaySpeed) * p.data.mov.y * SPEED;
			
			p.pos.xv *= Math.pow(0.98, (1 / replaySpeed));
			p.pos.yv *= Math.pow(0.98, (1 / replaySpeed));
			
			p.pos.x += (1 / replaySpeed) * p.pos.xv;
			p.pos.y += (1 / replaySpeed) * p.pos.yv;
		}
		
		if(lPlayers.length > 1){
			var avgX = 0, avgY = 0;
			for(var i = 0; i < lPlayers.length; i++){
				avgX += lPlayers[i].x;
				avgY += lPlayers[i].y;
			}
			avgX /= lPlayers.length;
			avgY /= lPlayers.length;
			
			var maxDist = 0;
			for(var i = 0; i < lPlayers.length; i++)
				maxDist = Math.max(Math.hypot(lPlayers[i].x - avgX, lPlayers[i].y - avgY), maxDist);
			var tScale = height / maxDist * 0.45;
			tScale = Math.max(1, Math.min(2, tScale));
			
			var cMix = frame == 0 ? 0 : 0.9;
			camera.x = camera.x * cMix + avgX * (1 - cMix);
			camera.y = camera.y * cMix + avgY * (1 - cMix);
			camera.scale = camera.scale * cMix + tScale * (1 - cMix);
		}
		
		for(var i = 0; i < f.bullets.length; i++){
			b = f.bullets[i];
			ctx.strokeStyle = "hsl(" + players[b.s].data.color + ", 100%, 50%)";
			ctx.beginPath();
			ctx.moveTo(b.x, b.y);
			ctx.lineTo(b.x + Math.cos(b.r) * BSPEED, b.y + Math.sin(b.r) * BSPEED);
			ctx.stroke();
			if(frame % replaySpeed == 0)
				continue;
			b.x += (1 / replaySpeed) * Math.cos(b.r) * BSPEED;
			b.y += (1 / replaySpeed) * Math.sin(b.r) * BSPEED;
		}
		
		for(var i = 0; i < f.asteroids.length; i++){
			var a = f.asteroids[i];
			ctx.strokeStyle = a.color;
			ctx.beginPath();
			ctx.moveTo(
				a.points[a.points.length - 1].r * Math.cos(a.points[a.points.length - 1].a + a.r) + a.x,
				a.points[a.points.length - 1].r * Math.sin(a.points[a.points.length - 1].a + a.r) + a.y
			);
			for(var n = 0; n < a.points.length; n++)
				ctx.lineTo(
					a.points[n].r * Math.cos(a.points[n].a + a.r) + a.x,
					a.points[n].r * Math.sin(a.points[n].a + a.r) + a.y
				);
			ctx.stroke();
			if(frame % replaySpeed == 0)
				continue;
			a.x += (1 / replaySpeed) * a.xv;
			a.y += (1 / replaySpeed) * a.yv;
			a.r += (1 / replaySpeed) * a.rv;
			if(a.x < -2 * a.rad)
				a.x += width + 4 * a.rad;
			if(a.y < -2 * a.rad)
				a.y += height + 4 * a.rad;
			if(a.x > width + 2 * a.rad)
				a.x -= width + 4 * a.rad;
			if(a.y > height + 2 * a.rad)
				a.y -= height + 4 * a.rad;
		}
		
		for(var i = 0; i < f.particles.length; i++){
			var p = f.particles[i];
			
			ctx.globalAlpha = Math.min(p.g, 1);
			ctx.fillStyle = p.c;
			ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
			ctx.globalAlpha = 1;
			
			if(frame % replaySpeed == 0)
				continue;
			
			p.x += (1 / replaySpeed) * Math.cos(p.r) * p.s;
			p.y += (1 / replaySpeed) * Math.sin(p.r) * p.s;
			p.r += (1 / replaySpeed) * p.rv;
			p.s *= Math.pow(0.98, (1 / replaySpeed));
			p.rv *= Math.pow(0.98, (1 / replaySpeed));
			p.g *= Math.pow(0.98, (1 / replaySpeed));
		}
		
		for(var i = 0; i < f.explosions.length; i++){
			ctx.globalAlpha = 0.2;
			ctx.fillStyle = "white";
			ctx.beginPath();
			ctx.arc(f.explosions[i].x, f.explosions[i].y, 16 + 32 * Math.random(), 0, Math.PI * 2);
			ctx.fill();
		}
		
		frame++;
	}
}

function startPlayer(){
	document.getElementById("mobile").style.top = "-100vh";
	setTimeout(function(){
		document.getElementById("mobile").style.display = "none";
	}, 300);
	me.data.mov = {
		x: 0, y: 0
	}
	var touchArr = [];
	var dpi = window.devicePixelRatio;
	var width = window.innerWidth * dpi;
	var height = window.innerHeight * dpi;
	var sideways = true;
	var c = document.getElementById("c");
	var ctx = c.getContext("2d");
	var buttons = {
		A: false,
		Joystick: [0, 0]
	}
	var rect = c.getBoundingClientRect();
	function update(){
		requestAnimationFrame(update);
		if(window.innerWidth < window.innerHeight && (!sideways || window.innerHeight * dpi != width)){
			sideways = true;
			width = window.innerHeight * dpi;
			height = window.innerWidth * dpi;
			c.height = height;
			c.width = width;
			c.style.height = height / dpi + "px";
			c.style.width = width / dpi + "px";
			c.className = "side";
			ctx = c.getContext("2d");
			rect = c.getBoundingClientRect();
		}
		if(window.innerWidth > window.innerHeight && (sideways || window.innerHeight * dpi != height)){
			sideways = false;
			height = window.innerHeight * dpi;
			width = window.innerWidth * dpi;
			c.height = height;
			c.width = width;
			c.style.height = height / dpi + "px";
			c.style.width = width / dpi + "px";
			c.className = "";
			ctx = c.getContext("2d");
			rect = c.getBoundingClientRect();
		}
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = buttons.A ? "#111" : "#222";
		ctx.beginPath();
		ctx.arc(width / 4, height / 2, height / 6, 0, 2 * Math.PI);
		ctx.fill();
		ctx.fillStyle = "#222";
		ctx.beginPath();
		ctx.arc(width * 3 / 4, height / 2, height / 4, 0, 2 * Math.PI);
		ctx.fill();
		
		ctx.fillStyle = "hsl(" + me.data.color + ", 100%, 50%)";
		// ctx.fillStyle = "white";
		ctx.font = height / 4 + "px DotGothic16";
		ctx.fillText("A", width / 4 - height / 16, height / 2 + height / 12);
		
		ctx.beginPath();
		ctx.arc(
			width * 3 / 4 + height / 4 * buttons.Joystick[0],
			height / 2 + height / 4 * buttons.Joystick[1],
			height / 8, 0, 2 * Math.PI
		);
		ctx.fill();
		
		// console.log(buttons.Joystick[0], buttons.Joystick[1]);
		// if(buttons.Joystick[0] != 0 || buttons.Joystick[1] != 0)
		// 	me.data.mov.r = Math.atan2(buttons.Joystick[1], buttons.Joystick[0]);
// 		me.data.mov.xv += buttons.Joystick[0] * SPEED;
// 		me.data.mov.yv += buttons.Joystick[1] * SPEED;
// 		me.data.mov.xv *= 0.98;
// 		me.data.mov.yv *= 0.98;
// 		me.data.mov.x += me.data.mov.xv;
// 		me.data.mov.y += me.data.mov.yv;
		
// 		if(me.data.mov.x < 7){
// 			me.data.mov.x = 7;
// 			me.data.mov.xv = Math.abs(me.data.mov.xv);
// 		}
		
// 		if(me.data.mov.y < 7){
// 			me.data.mov.y = 7;
// 			me.data.mov.yv = Math.abs(me.data.mov.yv);
// 		}
		
// 		if(me.data.mov.x > arenaWidth - 7){
// 			me.data.mov.x = arenaWidth - 7;
// 			me.data.mov.xv = -Math.abs(me.data.mov.xv);
// 		}
		
// 		if(me.data.mov.y > arenaHeight - 7){
// 			me.data.mov.y = arenaHeight - 7;
// 			me.data.mov.yv = -Math.abs(me.data.mov.yv);
// 		}
		
		me.data.mov = {
			x: buttons.Joystick[0],
			y: buttons.Joystick[1]
		}
		
		me.ref.set(me.data);
		
		if(buttons.A){
			buttons.A = false;
			database.ref(code + "/bullets").push().set({
				s: me.ref.path.pieces_[2]
			});
		}
	}
	update();
	function arrCont(str){
		for(var i in touchArr)
			if(touchArr[i] == str)
				return true;
		return false;
	}
	c.addEventListener("touchstart", function(e){
		e.preventDefault();
		for(var i = 0; i < e.changedTouches.length; i++){
			t = e.changedTouches[i];
			var x = t.clientX, y = t.clientY;
			x -= rect.x; y -= rect.y;
			x *= dpi;
			y *= dpi;
			if(sideways){
				var temp = x
				x = width - y;
				y = temp;
			}
			touchArr[t.identifier] = "";
			if(Math.hypot(x - width * 3 / 4, y - height / 2) < height * 0.4)
				if(!arrCont("J"))
					touchArr[t.identifier] = "J";
			if(touchArr[t.identifier] == "" && Math.hypot(x - width / 4, y - height / 2) < height * 0.5)
				if(!arrCont("A")){
					touchArr[t.identifier] = "A";
					buttons.A = true;
				}
		}
		tMove(e);
	});
	function tMove(e){
		e.preventDefault();
		for(var i = 0; i < e.changedTouches.length; i++){
			t = e.changedTouches[i];
			if(touchArr[t.identifier] == "J"){
				var x = t.clientX, y = t.clientY;
				x -= rect.x; y -= rect.y;
				x *= dpi;
				y *= dpi;
				if(sideways){
					var temp = x
					x = width - y;
					y = temp;
				}
				var po = [(x - width * 3 / 4) / height * 4, (y - height / 2) / height * 4];
				var l = Math.hypot(po[0], po[1]);
				if(l > 1)
					po = [po[0] / l, po[1] / l];
				buttons.Joystick = po;
			}
		}
	};
	c.addEventListener("touchmove", tMove);
	c.addEventListener("touchend", function(e){
		for(var i = 0; i < e.changedTouches.length; i++){
			t = e.changedTouches[i];
			if(touchArr[t.identifier] == "A")
				buttons.A = false;
			if(touchArr[t.identifier] == "J")
				buttons.Joystick = [0, 0];
			delete touchArr[t.identifier];
		}
	});
}

var smi = document.getElementsByClassName("smallinp");
for(var i = 0; i < smi.length; i++)
	smi[i].onclick = noB;

function noB(e){
	if(document.getElementById("dropdown").className != "open")
		e.stopPropagation();
}

var selectedMode = typeof localStorage.selectedMode == "undefined" ? 0 : parseInt(localStorage.selectedMode);
document.getElementById("doffset").style.marginTop = -4.8 * selectedMode + "vmin";
var modeVal = typeof localStorage.modeVal == "undefined" ? 0 : parseInt(localStorage.modeVal);
document.getElementsByClassName("srow")[selectedMode].children[0].value = modeVal;
document.getElementById("dropdown").onclick = function(e){
	if(this.className == ""){
		this.className = "open";
		document.getElementById("doffset").style.marginTop = 0;
		var c = this.children[0].children;
		for(var i = 0; i < c.length; i++){
			if(i != selectedMode)
				c[i].children[0].value = c[i].children[0].placeholder;
			c[i].children[0].disabled = true;
		}
	}else{
		this.className = "";
		var t = (e.target.className == "smallinp" || e.target.className == "darker") ? e.target.parentNode : e.target;
		var s = Array.prototype.indexOf.call(this.children[0].children, t);
		if(s >= 0)
			selectedMode = s;
		document.getElementById("doffset").style.marginTop = -4.8 * selectedMode + "vmin";
		modeVal = parseInt(this.children[0].children[selectedMode].children[0].value);
		
		localStorage.modeVal = modeVal;
		localStorage.selectedMode = selectedMode;
		
		var c = this.children[0].children;
		for(var i = 0; i < c.length; i++)
			c[i].children[0].disabled = false;
	}
}

function changeModeVal(e){
	if(e.value == ""){
		modeVal = 10;
		localStorage.modeVal = modeVal;
		return;
	}
	if(/\D/.test(e.value) || e.value.length > 2)
		e.value = e.value.slice(0, -1);
	if(e.value < parseInt(e.min)){
		e.value = "";
		modeVal = 10;
	}else
		modeVal = parseInt(e.value);
	localStorage.modeVal = modeVal;
}

function newGame(){
	status = 3;
	database.ref(code + "/status").set(status);
	reload();
}

function reload(){
	localStorage.setItem("code", code);
	location.href = location.href;
	//location.href = location.href.split("?")[0] + (code ? "?code=" + code : "");
}
