var numgl = {
	// WebGL context.
	gl: null,

	// START - Find out if WebGL is enabled.
	init: function() {
		numgl.canvas = document.createElement("canvas");

		// XXX: This also defines the viewport, so make sure to also change it later.
		numgl.canvas.width = numgl.canvas.height = 0;

		try {
			// { preserveDrawingBuffer: true } enables readPixels() to read the computed values from the canvas.
			numgl.gl = numgl.canvas.getContext("webgl",{preserveDrawingBuffer: true}) || 
						numgl.canvas.getContext("experimental-webgl", {preserveDrawingBuffer: true});
		}
		catch(e) {}
	  
		if(!numgl.gl) {
			alert("Unable to initialize WebGL. Your browser may not support it.");
		}

		numgl.animation_frame_polyfill();
	},

	// Taken from https://gist.github.com/paulirish/1579671
	animation_frame_polyfill: function() {
		var lastTime = 0;
		var vendors = ['ms', 'moz', 'webkit', 'o'];

		for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
			window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame']
										|| window[vendors[x]+'CancelRequestAnimationFrame'];
		}

		if (!window.requestAnimationFrame)
			window.requestAnimationFrame = function(callback, element) {
				var currTime = new Date().getTime();
				var timeToCall = Math.max(0, 16 - (currTime - lastTime));
				var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
				lastTime = currTime + timeToCall;
				return id;
			};

		if (!window.cancelAnimationFrame)
			window.cancelAnimationFrame = function(id) {
				clearTimeout(id);
			}; 
	},


	canvas: null,
	// Indicates if the canvas is on the DOM or not.
	canvasOnDOM: null,

	// natural - natural values for textures, ie (255,255,255,1) TODO: float - send data as floats.
	textureEncoding: "natural",

	requestId: null,
	fpsElement: null,

	set_fps_element: function(fpsElementId) {
		var fpsElement;

		if(!fpsElementId) {
			// Default - If no fpsElementId was given, creates div appends it to the body.
			fpsElement = document.createElement("div");
			document.body.appendChild(fpsElement);
		} else {
			fpsElement = document.getElementById(fpsElementId);
		}

		numgl.fpsElement = fpsElement;
	},

	start_loop: function() {
		if (numgl.requestId || !numgl.textures.length) {
			// Loop already running || there is nothing to play.
			return; 
		} 

		var numFramesToAvg = 60,
			frameTimeHistory = [],
			frameTimeIndex=0,
			totalTimeForFrames=0,
			// FIXME: Assumes video ID is 0.
			vidId = 0,
			// Time in seconds (it's not really necessary to define it here).
			past = 0; //Date.now()/1000;

		// If gl_FragColor is not defined it's because the video is not currently being processed and will not be shown.
		if(!numgl.fragColor) {
			numgl.fragColor = "texture2D(uTexture"+vidId+", vTextCoords)";
		}
	
		numgl.handle_scene();
		numgl.init_texture(vidId);

		// FIXME: better fps.
		if(!numgl.fpsElement) {
			numgl.fpsElement = {};
		}

		var loop = function() {
			// FSP stuff - Time in seconds - Taken from http://stackoverflow.com/questions/16432804/recording-fps-in-webgl
			var now = Date.now()/1000; 

			// Time since last frame.
			var passedTime = now - past;
			past = now;

			// Sum of all the stored times. The '-' part removes the previous value from the sum, so it's only 'summed' once.
			totalTimeForFrames += passedTime - (frameTimeHistory[frameTimeIndex] || 0);
			// Record the new time.
			frameTimeHistory[frameTimeIndex] = passedTime;
			// Update the history index - it goes from 0 to 'numFramesToAvg' and then back to 0 again.
			frameTimeIndex = (frameTimeIndex + 1) % numFramesToAvg;
			// Actual averaging of frames happens here.
			var averageElapsedTime = totalTimeForFrames / frameTimeHistory.length;
			numgl.fpsElement.innerHTML = Math.floor(1 / averageElapsedTime)

			// WebGL render stuff.
			// The bound texture and properties are set in the numgl.init_texture() outside of this loop.
			numgl.gl.texImage2D(numgl.gl.TEXTURE_2D,0,numgl.gl.RGB, numgl.gl.RGB, numgl.gl.UNSIGNED_BYTE, numgl.textures[vidId]);

			// The bound and enabled vertex data are set in the numgl.handle_scene() outside of this loop.
			numgl.gl.drawArrays(numgl.gl.TRIANGLES, 0, 6);

			numgl.requestId = window.requestAnimationFrame(loop);
		}

		// Start the video.
		numgl.start_video();
		loop();
	},

	start_video: function() {
		// FIXME: Assumes the videoId is 0.
		numgl.textures[0].play();
	},

	stop_loop: function() {
		if(numgl.requestId) {
			numgl.pause_video();
			window.cancelAnimationFrame(numgl.requestId);
			numgl.requestId = null;
		}
	},

	pause_video: function() {
		// FIXME: Assumes the videoId is 0.
		numgl.textures[0].pause();
	},

	start_pause_button: function() {
		if(numgl.requestId) {
			numgl.stop_loop();
		} else {
			numgl.start_loop();
		}
	},

	// Taken from: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Taking_still_photos
	store_webcam: function(videoElement) {
		videoElement = document.getElementById(videoElement);
		navigator.getMedia = (navigator.getUserMedia ||
						navigator.webkitGetUserMedia ||
						navigator.mozGetUserMedia ||
						navigator.msGetUserMedia);

		navigator.getMedia(
			{
				video: true,
				audio: false
			},
			function(stream) {
				if (navigator.mozGetUserMedia) {
					videoElement.mozSrcObject = stream;
				} else {
					var vendorURL = window.URL || window.webkitURL;
					videoElement.src = vendorURL.createObjectURL(stream);
				}
				// Plays the video twice?
				// videoElement.play();
			},

			function(err) {
				console.log("An error occured! ", err);
			}
		);		

		var textureId = numgl.store_texture(videoElement);
		numgl.textureInfo[textureId].type = "webcam";
		return textureId;
	},

	// The video also gets stored as a texture.
	store_video: function(videoElement) {
		videoElement = document.getElementById(videoElement);
		// Auto - browser should load the entire video when the page loads. (doesn't work without this)
		videoElement.preload = "auto";

		var textureId = numgl.store_texture(videoElement);
		numgl.textureInfo[textureId].type = "video";
		return textureId;
	},

	// Receives an img tag Id or an Image object. FIXME: Does this really work with id's and elements?
	store_picture: function(pictureElement) {
		if(typeof pictureElement == "string") {
			pictureElement = document.getElementById(pictureElement);
		}

		return numgl.store_texture(pictureElement);
	},

	// Define width and height of the array, and store it as a texture.
	store_array: function(arr, width, height) {
		arr.width = width;
		arr.height = height;

		return numgl.store_texture(arr);
	},

	// XXX: Not currently used - The passed in data is an array of numbers.
	store_float_vector: function(data) {
		var numVectors = numgl.floatVectors.length;
		
		numgl.fsGlobalVariables += "uniform float uFloatVector" + numVectors + "[" + data.length + "];" +
									"uniform float uFloatVectorSize" + textureId + "; "

		numgl.floatVectors.push(data);
		return numVectors;
	},

	// Store data as a texture to be later sent to the GPU.
	store_texture: function(data, flipTexture) {
		var numTextures = numgl.textures.length;

		if(numgl.textureEncoding == "float") {
			// TODO: Encode texture as float.
			numgl.textures.push(float_encode(data))
		} else {
			// Store data to texture as it is, without any processing.
			numgl.textures.push(data)
		}

		// Flow: If flipTexture was specified, use it. If it was not specified, only flip images and videos.
		if(flipTexture != undefined) {
			numgl.textures[numTextures].flipTexture = flipTexture;
		} else if((numgl.textures[numTextures] instanceof Image) || data.tagName == "IMG" || data.tagName == "VIDEO") {
			numgl.textures[numTextures].flipTexture = true;
		}

		numgl.fs_texture_variable(numTextures);
		// Return the texture ID.
		return numTextures;
	},

	show_canvas: function(Id, parentElementId){
		// Set scene width.
		if(!numgl.canvas.width) {
			numgl.canvas.width = numgl.textures[Id].width;
		}

		if(!numgl.canvas.height) {
			numgl.canvas.height = numgl.textures[Id].height;
		}

		// The viewport doesn't change with the canvas size, so we have to do it manually.
		numgl.gl.viewport(0, 0, numgl.canvas.width, numgl.canvas.height);

		numgl.append_canvas(parentElementId);
	},

	// The stored textures aren't drawn by default. This function draws them.
	show_texture: function(Id, parentElementId) {
		numgl.show_canvas(Id,parentElementId);

		// Add pixel shader code to draw the texture.
		numgl.fragColor = "texture2D(uTexture"+Id+", vTextCoords)"

		numgl.do_it();
	},

	// TODO:
	float_encode: function() {
		
	},

	// Textures - this array will have aditional properties eg width and height.
	textures: [],
	// Holds some textures properties, like the string to display the texture inside the shader.
	textureInfo: [],
	// Float vectors to be passed to the fragment shader.
	floatVectors: [],

	//
	// Functions that write GLSL code - these functions return vec4's that are used to define gl_FragColor.
	//

	// Make sure the shader variable is in fact a variable that's inside the shade, and give it some properties.
	get_real_variable: function(shaderVar) {
		if(!isNaN(shaderVar)) {
			// If the passed in shaderVar is a number, it's because the shaderVar is a textureId => convert it to shader text var.
			shaderVar = numgl.textureInfo[shaderVar];
		}

		if(typeof shaderVar == "string") {
			shaderVar = [shaderVar];
			shaderVar.r = shaderVar + ".r";
			shaderVar.g = shaderVar + ".g";
			shaderVar.b = shaderVar + ".b";
		}

		return shaderVar;
	},

	// Black and white threshold - 'thresh' value is between 0 and 255, which is then converted to 0.0 - 1.0.
	threshold: function(shaderVar, thresh) {
		var finalColor;
		// FIXME: This (below) is the numgl.grey() function!!
		// Default weights (luminance-preserving weights).
		var redWeight = 0.2126;
		var greenWeight = 0.7152;
		var blueWeight = 0.0722;

		shaderVar = numgl.get_real_variable(shaderVar);

		var redWeighted = numgl.multiply(redWeight,shaderVar.r);
		var greenWeighted = numgl.multiply(greenWeight, shaderVar.g);
		var blueWeighted = numgl.multiply(blueWeight, shaderVar.b);

		var weightedSum = numgl.add(redWeighted, blueWeighted, greenWeighted);
		// FIXME: This (above) is the numgl.grey() function!!
		
		// Conver to 0.0 - 1.0.
		thresh = thresh/255;
		// Make sure 'thresh' is a float.
		thresh = numgl.float_string(thresh);		

		// If greater than passed int 'thresh', paint white.
		finalColor = numgl.fs_main_variable("vec4(0.0,0.0,0.0,1.0);","vec4");
		numgl.fsMainCode = "if(" + weightedSum + " >= " + thresh + ") {" +
							finalColor + " = vec4(1.0,1.0,1.0,1.0); }"

		numgl.fragColor = finalColor;
		return finalColor;
	},

	// Creates a GLSL function that performs convolutions. Args - kernel is a JS array.
	convolution: function(textureId, kernel) {
		var matrixRows = matrixCols = Math.sqrt(kernel.length),
			halfSize = Math.floor(matrixRows/2),
			vecIdx = 0,
			totalKernelWeight = 0,
			kernelValue,
			pixelValue,
			firstPartStr = "",
			finalStr = "",
			finalColor;

		// FIXME: This doesnt work! Because a texture is needed in texture2D... shaderVar = numgl.get_real_variable(shaderVar);

		if(matrixRows%1 != 0) {
			alert("Matrix is not a square matrix");
			return;
		}	

		if(matrixRows%2 != 1 || matrixRows == 1) {
			alert("Matrix does not have an odd number of rows and cols. (or it's length is == 1)");
			return;
		}

		// XXX: This calculation could be done on the javascript side?
		pixelValue = "vec2(" + 1/numgl.canvas.width + "," + 1/numgl.canvas.height + ")";
		// Removes the last ")" in "texture2D(uTexture"+textureId+", vTextCoords)".
		firstPartStr = numgl.textureInfo[textureId].rgba.substring(0, numgl.textureInfo[textureId].rgba.length - 1);

		for(var i = -halfSize; i <= halfSize; i++) {
			for(var ii = -halfSize; ii <= halfSize; ii++, vecIdx++) {
				kernelValue = numgl.float_string(kernel[vecIdx]);

				// Build a string of the type: texture2D(texture0, vTextCoords + pixelValue * vec2(a, b)) * (kernelValue) + (...)
				finalStr = finalStr + firstPartStr + "+" + pixelValue + "*" + "vec2(" + ii + "," + i +")) * " + kernelValue + "+\n"
				
				// Update the kernel weight to be used in the kernel normalization (see links bellow).			
				totalKernelWeight = totalKernelWeight + kernel[vecIdx];
			}
		}

		// Remove the last "+".
		finalStr = finalStr.substring(0, finalStr.length-2);
		finalStr = finalStr + ";";

		// http://en.wikipedia.org/wiki/Kernel_%28image_processing%29#Normalization
		// http://www.codeproject.com/Articles/6534/Convolution-of-Bitmaps
		if(totalKernelWeight <= 0) {
			totalKernelWeight = 1;
		}

		// Create convolution function.
		numgl.fsUserFunctions = "vec3 convolution() {\n" +
								"vec4 sum = " + finalStr +" \n" +
								"return (sum/"+numgl.float_string(totalKernelWeight)+").rgb; }\n";
		finalColor = numgl.fs_main_variable("convolution();", "vec3");
		finalColor = numgl.vec4(finalColor, "1.0");

		numgl.fragColor = finalColor;
		return finalColor;
	},

	// Convert passed in texture to grey - returns a vec4 to be used in 
	grey: function(shaderVar, redWeight, greenWeight,blueWeight) {
		var finalColor;
		// Default weights (luminance-preserving weights).
		if(!redWeight) {
			redWeight = 0.2126;
			greenWeight = 0.7152;
			blueWeight = 0.0722;
		}

		shaderVar = numgl.get_real_variable(shaderVar);

		var redWeighted = numgl.multiply(redWeight,shaderVar.r);
		var greenWeighted = numgl.multiply(greenWeight, shaderVar.g);
		var blueWeighted = numgl.multiply(blueWeight, shaderVar.b);
		
		var weightedSum = numgl.add(redWeighted, blueWeighted, greenWeighted);
		finalColor = numgl.vec4(weightedSum, weightedSum, weightedSum, 1);

		numgl.fragColor = finalColor;
		return finalColor;
	},

	// XXX: Arguments leak! https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#3-managing-arguments
	// XXX: The arguments object is not an Array. It's similar to an Array but doesn't have any Array properties except length.
	add: function() {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; i++) {
			args[i] = arguments[i];
		}
		return numgl.operation(" + ", args);
	},

	subtract: function() {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; i++) {
			args[i] = arguments[i];
		}
		return numgl.operation(" - ", args);
	},

	multiply: function() {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; i++) {
			args[i] = arguments[i];
		}
		return numgl.operation(" * ", args);
	},

	divide: function() {
		var args = new Array(arguments.length);
		for(var i = 0; i < args.length; i++) {
			args[i] = arguments[i];
		}
		return numgl.operation(" / ", args);
	},

	// Creates a mathematical equation string. eg: "1 + 2;" receives 3 arguments: the sign " + ", 1 and 2. Returns result var name.
	// XXX: The type of the operation defaults to "float" (this is done in numgl.fs_main_variable())
	operation: function(sign, elements) {
		var finalString = "",
			type;

		if(numgl.check_operation_type(elements[0])) {
			type = elements[0];
			// If the first element of the array "elements" is the type of the operation, remove that element.
			elements.shift();
		}

		for (var i = 0; i < elements.length - 1; i++) {
			elements[i] = numgl.float_string(elements[i])

			finalString += elements[i] + sign;
		}

		if(!isNaN(elements[i]) && elements[i]%1 == 0) {
			// If the element is a number &AND& not a float, convert it to a float.
			elements[i] = elements[i] + ".0";
		}
		finalString = finalString + elements[i] + ";"

		return numgl.fs_main_variable(finalString,type);
	},

	// Convert number to float, and stringify's it.
	float_string: function(number) {
		if(!isNaN(number) && number%1 == 0) {
			// If the element is a number &AND& not a float, convert it to a float.
			number = number + ".0";
		}

		return number;
	},

	check_operation_type: function(type) {
		var typeExists = true;

		// FIXME: Missing GLSL types.
		switch(type) {
			case "float":
				break;
			case "vec2":
				break;
			case "vec3":
				break;
			case "vec4":
				break;
			default:
				typeExists = false;
				break;
		}

		return typeExists;
	},

	// TODO: Change this to any type of WebGL array or matrix, vec2, vec3, mat2, etc...
	vec4: function() {
		var finalString = "vec4(";

		for (var i = 0; i < arguments.length - 1; i++) {
			finalString += arguments[i] + ",";
		}
		finalString += arguments[i] + ");"

		return numgl.fs_main_variable(finalString, "vec4");
	},

	// Variables that will create the GLSL frag shader code. XXX: The numgl.fragColor has to be defined! (it defaults to all white)
	fragColor: "",
	fsGlobalVariables: "",
	fsUserFunctions: "",
	fsMainVariables: "",
	fsMainCode: "",
	fsMainVariablesList: {},

	vertexShaderMain: "",
	vertexShaderVariables: "", 

	// Show the canvas. Changes the numgl.canvasOnDOM to 'true'. The WebGL canvas is invisible by default.
	append_canvas: function(parentElement) {
		if(numgl.canvasOnDOM) {
			return;
		}

		// If no parentElement was passed in, defaults to 'body'.
		if(!parentElement) {
			document.body.appendChild(numgl.canvas);
		} else {
			parentElement.appendChild(numgl.canvas);
		}

		numgl.canvasOnDOM = true;
	},

	// Adds variable to the main function of the fragment shader. varExpression is what comes after the "=".
	fs_main_variable: function(varExpression, type) {
		var varName;

		// Default type to "float".
		if(!type) {
			type = "float";
		}

		if(numgl.fsMainVariablesList[type] == undefined) {
			// First variable of this type.
			numgl.fsMainVariablesList[type] = 0;
		} else {
			numgl.fsMainVariablesList[type] =numgl.fsMainVariablesList[type]+ 1;
		}
		
		varName = type + "_" + numgl.fsMainVariablesList[type];
		// The actual line of code to be added to the fragment shader.
		numgl.fsMainVariables += type + " " + varName + " = " + varExpression;

		return varName;
	},

	// Add the texture data and size variables to the fragment shader. 
	fs_texture_variable: function(textureId) {		

		numgl.textureInfo[textureId] = {};
		numgl.textureInfo[textureId].rgba = "texture2D(uTexture"+textureId+", vTextCoords)";
		numgl.textureInfo[textureId].r = "texture2D(uTexture"+textureId+", vTextCoords).r";
		numgl.textureInfo[textureId].g = "texture2D(uTexture"+textureId+", vTextCoords).g";
		numgl.textureInfo[textureId].b = "texture2D(uTexture"+textureId+", vTextCoords).b";
		numgl.textureInfo[textureId].varName = "uTexture" + textureId;

		// Update current fragment shader code.
		numgl.fsGlobalVariables += "uniform sampler2D uTexture" + textureId + "; " +
									"uniform vec2 uTextureSize" + textureId + "; ";
	},

	fsFloatPrecision: "precision highp float; ",

	// Generate code for the pixel shader aka fragment shader.
	fs_code: function(pretty) {
		var fragColor = numgl.fragColor,
			mainVariables = numgl.fsMainVariables, 
			globalVariables = numgl.fsGlobalVariables,
			userFunctions = numgl.fsUserFunctions,
			mainCode = numgl.fsMainCode;

		if(!fragColor) {
			// Default pixel shader main function.
			fragColor = "vec4(1.0, 1.0, 1.0, 1.0)";
			console.log("No fragColor was specified for the fragment shader - will default to", fragColor);
		}

		// XXX: https://code.google.com/p/glsl-unit/issues/detail?id=9
		// TLDR: Fragment shaders have no default float precision, so varying/uniform floats need precision declarations.
		// TLDR TLDR: Always put the precision declaration at the beginning of the fragment shader!
		code = numgl.fsFloatPrecision + 
				"uniform vec2 uResolution; " +
				globalVariables + 
				"varying vec2 vTextCoords; " +
				userFunctions + 
				"void main(void) { " + 
				mainVariables + 
				mainCode +
				"gl_FragColor = "+ fragColor +"; " +				
				"}";

		// TODO: Better pretty print of the code.
		if(pretty == "pretty") {
			code = code.replace(/;/g,";\n" )
			code = code.replace(/}/g,"}\n" )
			code = code.replace(/{/g,"{\n" )
		}

		return code;
	},
	
	// Final code for the fragment shader. This is the code that's going to be compiled.
	fsFinalCode: "",

	// Generate code for the vertex shader.
	vs_code: function(pretty) {
		var mainFunction = numgl.vertexShaderMain,
			variables = numgl.vertexShaderVariables;

		if(!mainFunction) {
			// Default pixel shader main function.
			mainFunction = "gl_Position = vec4(aVertexPosition, 1.0); "+
							"vTextCoords = vec2(aVertexPosition.st)*0.5 + 0.5; ";
		}

		if(!variables) {
			variables = "attribute vec3 aVertexPosition; "
		}

		code = variables + 
				"varying vec2 vTextCoords; "+
				"void main(void) { " + mainFunction + "} ";

		// TODO: Better pretty print of the code.
		if(pretty == "pretty") {
			code = code.replace(/;/g,";\n" )
			code = code.replace(/}/g,"}\n" )
			code = code.replace(/{/g,"{\n" )
		}

		return code;
	},

	// Final code for the fragment shader. This is the code that's going to be compiled.
	vsFinalCode: "",

	// Create program and draw scene. Used for single pictures.
	do_it: function() {
		var textureId = 0;

		numgl.create_code();
		numgl.create_program(numgl.fsFinalCode, numgl.vsFinalCode);

		// FIXME: The textureId may not be 0. eg if the user loads more than 1 image or video. For now, let's assume that's true.
		
		if(!numgl.textureInfo[textureId]) {
			console.log("\n\nWARNING: There texture",textureId,"does not exist.\n\n");
			numgl.draw_scene();
		} else if(numgl.textureInfo[textureId].type == "webcam") {
			// Webcam
			numgl.textures[textureId].addEventListener("canplay", numgl.start_loop, true);
		} else if(numgl.textureInfo[textureId].type == "video") {
			// Video
			numgl.textures[textureId].addEventListener("canplaythrough", numgl.start_loop, true);
		} else {
			// Default - Images, arrays, etc...
			if(numgl.textures[textureId].hasOwnProperty("onload")) {
				// If the image is done loading, draw_scene(), otherwise wait for onload event. XXX window.onload clears this.
				if(numgl.textures[textureId].complete) {
					numgl.draw_scene();
				} else {
					numgl.textures[textureId].onload = numgl.draw_scene;
				}
			} else {
				numgl.draw_scene();
			}
		}

		// Reset the shaders' code.
		numgl.vsFinalCode = numgl.fsFinalCode = "";
	},

	create_code: function() {
		// TODO: Different shader code building options: just JS, just GLSL, or a mix of both. (only JS supported right now)
		// Generate pixel shader and vertex shader code.
		if(!numgl.fsFinalCode) {
			numgl.fsFinalCode = numgl.fs_code("pretty");
		}

		if(!numgl.vsFinalCode) {
			numgl.vsFinalCode = numgl.vs_code("pretty");
		}

		//DEBUG fsCode = "void main(void) { gl_FragColor = vec4(0, 0, 1, 1); }"
	},

	// WebGL program to be used.
	program: null,

	create_program: function(fsCode,vsCode) {
		// Get shader code			
		var pixelShader,
			vertexShader;

		console.log("About to create a program with the fragment shader code:\n\n", fsCode,"\nand vertex shader code:\n\n", vsCode)

		// Compile shaders.
		vertexShader = numgl.compile_shader(vsCode, numgl.gl.VERTEX_SHADER);
		fragmentShader = numgl.compile_shader(fsCode, numgl.gl.FRAGMENT_SHADER);

		// Create program.
		numgl.program = numgl.gl.createProgram();

		// Attach and link shaders to the program.
		numgl.gl.attachShader(numgl.program, vertexShader);
		numgl.gl.attachShader(numgl.program, fragmentShader);
		numgl.gl.linkProgram(numgl.program);

		if(!numgl.gl.getProgramParameter(numgl.program, numgl.gl.LINK_STATUS)) {
			alert("Unable to initialize the shader program.");
		}		

		numgl.gl.useProgram(numgl.program);
	},

	// This function is called from create_program (above function) to compile the vertex and pixel shaders.
	compile_shader: function(src, type) {
		var shader = numgl.gl.createShader(type);
		
		numgl.gl.shaderSource(shader, src);
		numgl.gl.compileShader(shader);
		if(!numgl.gl.getShaderParameter(shader, numgl.gl.COMPILE_STATUS)) {
			alert("Error compiling shader (check the browser console for more info).");
			console.log("Error compiling shader",numgl.gl.getShaderInfoLog(shader));
		}

		return shader;
	},

	handle_float_vectors: function() {
		for(var i = 0; i < numgl.floatVectors.length; i++) {
			numgl.gl.uniformfv(numgl.gl.getUniformLocation(numgl.program, "uFloatVector" + i + "[0]"), numgl.floatVectors[i]);
			numgl.gl.uniform1f(numgl.gl.getUniformLocation(numgl.program, "uFloatVectorSize" + i), numgl.floatVectors[i].length);
		}
	},

	// textureData has to be 'Uint8Array'.
	handle_textures: function() {
		for(var i = 0; i < numgl.textures.length; i++) {
			numgl.init_texture(i)
		}
	},	

	// First define a unit for the texture, and bind the texture with that unit (activeTexture() followed by bindTexture()) ...
	// ... then assign that texture to a uniform using that unit (or number) (getUniformLocation() followed by uniform1i()).
	init_texture: function(textureId) {
		var texture,
			WebGLTexture = numgl.gl.createTexture(),
			h,
			w;
	
		// Tell WebGL what texture to bind in bindTexture(). If non is specified with activeTexture(), bindTexture() defaults to 0.
		numgl.gl.activeTexture(numgl.gl.TEXTURE0 + textureId);
		numgl.gl.bindTexture(numgl.gl.TEXTURE_2D, WebGLTexture);
	
		if(!numgl.gl.isTexture(WebGLTexture)) {
			alert("Error: Invalid texture.");
		}

		// Texture parameters
		numgl.gl.texParameteri(numgl.gl.TEXTURE_2D, numgl.gl.TEXTURE_MAG_FILTER, numgl.gl.NEAREST);
		numgl.gl.texParameteri(numgl.gl.TEXTURE_2D, numgl.gl.TEXTURE_MIN_FILTER, numgl.gl.NEAREST);
		numgl.gl.texParameteri(numgl.gl.TEXTURE_2D, numgl.gl.TEXTURE_WRAP_S, numgl.gl.CLAMP_TO_EDGE);
		numgl.gl.texParameteri(numgl.gl.TEXTURE_2D, numgl.gl.TEXTURE_WRAP_T, numgl.gl.CLAMP_TO_EDGE);

		if(numgl.textures[textureId].flipTexture) {
			numgl.gl.pixelStorei(numgl.gl.UNPACK_FLIP_Y_WEBGL, true);
		}

		w = numgl.textures[textureId].width;
		h = numgl.textures[textureId].height;

		// Image objects and array objects have different gl.texImage2D() calls.
		if((numgl.textures[textureId] instanceof Image)|| numgl.textures[textureId].tagName == "IMG"  || numgl.textures[textureId].tagName == "VIDEO") {
			texture = numgl.textures[textureId];
			numgl.gl.texImage2D(numgl.gl.TEXTURE_2D, 0, numgl.gl.RGBA, numgl.gl.RGBA, numgl.gl.UNSIGNED_BYTE, texture);
		} else {
			texture = new Uint8Array(numgl.textures[textureId]);
			numgl.gl.texImage2D(numgl.gl.TEXTURE_2D, 0, numgl.gl.RGBA, w, h, 0,numgl.gl.RGBA, numgl.gl.UNSIGNED_BYTE, texture);
		}

		// Assigns a number to a uniform. If none is assigned, defaults to 0.
		numgl.gl.uniform1i(numgl.gl.getUniformLocation(numgl.program, "uTexture" + textureId), textureId);

		// Pass the size of the texture to the shader.
		numgl.gl.uniform2f(numgl.gl.getUniformLocation(numgl.program, "uTextureSize" + textureId), w,h);

		return WebGLTexture;
	},
	
	draw_scene: function() {
		numgl.handle_scene();

		// Handle stored textures.
		numgl.handle_textures();
		// Handle stored float vectors.
		numgl.handle_float_vectors();
	
		numgl.gl.drawArrays(numgl.gl.TRIANGLES, 0, 6);		
	},

	// Define the 2 triangles that will make up the scene.
	handle_scene: function() {
		var triangleVertices = [
        -1.0, -1.0, 
         1.0, -1.0, 
        -1.0,  1.0, 
        -1.0,  1.0, 
         1.0, -1.0, 
         1.0,  1.0];

		var trianglesVerticeBuffer = numgl.gl.createBuffer();
		numgl.gl.bindBuffer(numgl.gl.ARRAY_BUFFER, trianglesVerticeBuffer);
		numgl.gl.bufferData(numgl.gl.ARRAY_BUFFER, new Float32Array(triangleVertices), numgl.gl.STATIC_DRAW);

		var vertexPositionAttribute = numgl.gl.getAttribLocation(numgl.program,"aVertexPosition");
		numgl.gl.enableVertexAttribArray(vertexPositionAttribute);
		numgl.gl.vertexAttribPointer(vertexPositionAttribute, 2, numgl.gl.FLOAT, false, 0, 0);

		// Define the resolution in the pixel shader.
		numgl.gl.uniform2f(numgl.gl.getUniformLocation(numgl.program, "uResolution"), numgl.canvas.width, numgl.canvas.height);
	},

	// Args - width and height of the area in the canvas to read from. 
	read_canvas: function(width, height) {
		var values;

		if(!width || !height) {
			// If no width and height are specified, default to read the whole canvas area.
			width = numgl.canvas.width;
			height = numgl.canvas.height
		}

		values = new Uint8Array(width*height*4);
		numgl.gl.readPixels(0, 0, width, height, numgl.gl.RGBA, numgl.gl.UNSIGNED_BYTE,values);

		return values;
	}
}

numgl.init();

