# NumGL

- Apply image processing algorithms using WebGL.
- Supports pictures, videos, webcam streams and user defined arrays.
- Everything is sent to the fragment shader as 2D textures.
- Let fragment shaders handle the hard work.
- <a href="https://jongomez.github.io/post/numgl/">Blog post.</a>

## Docs

### Store everything as a texture

---

- The store_* functions return a storageId, which is passed into the processing functions.

```javascript
window.onload = function() {
	// Send the picture to WebGL as texture. To do this with video/webcam...
	// ... change store_picture to store_video / store_webcam.
	var storageId = numgl.store_picture("imgElementID");
	numgl.show_texture(storageId);
}
```

---

### Greyscaling images

---

```javascript
numgl.grey(storageId);
```

Fiddle with it:

- <a href="http://jsfiddle.net/jongomez/q3n5gj7u/">Image</a>
- <a href="http://jsfiddle.net/sputro0e/">Video</a>
- <a href="https://jsfiddle.net/wm4gr6co/1/">Webcam</a>

---

### Convolution kernel

---

```javascript
// [-1,-1,-1,0,0,0,1,1,1] is a 3x3 kernel, where:
// - 1st row is [-1,-1,-1]; 2nd row is [0,0,0]; 3rd row is [1,1,1].
numgl.convolution(storageId, [-1,-1,-1,0,0,0,1,1,1]);

// Other kernels are supported.
```

JS Fiddle with it:

- <a href="http://jsfiddle.net/jongomez/6pgbwkff/">Image</a>
- <a href="http://jsfiddle.net/m1gbshz6/">Video</a>
- <a href="https://jsfiddle.net/rsn9cdkb/1/">Webcam</a>

---

### Thresholding

---

```javascript
// 80 is the thresholding value.
numgl.threshold(storageId, 80);
```

JS Fiddle:

- <a href="http://jsfiddle.net/jongomez/eap27rhq/">Image</a>
- <a href="http://jsfiddle.net/wuLcef2y/">Video</a>
- <a href="https://jsfiddle.net/w8f7z6eu/">Webcam</a>

---

### Example - Combine convolution with threshold.

---

- The image processing functions return the GLSL variable that will hold the final pixel value.
- This return variable can be used to chain call other image processing functions.

```javascript
window.onload = function() {
	var imageId = numgl.store_picture("image");

	numgl.show_canvas(imageId);
	// Convolution followed by threshold
	var convResult = numgl.convolution(imageId,[-1,-1,-1,0,0,0,1,1,1]);
	numgl.threshold(convResult,10);
	numgl.do_it();
}
```

JS Fiddle:

- <a href="http://jsfiddle.net/b091mkbh/5/">Image convolution + threshold</a>

---

### Other options

---

- Enable / disable fps for video and webcam

```javascript
// If this is not set, the fps are not shown.
numgl.set_fps_element(fpsElementId);

```

- Store JS arrays as RGBA textures

```javascript
// Draws the following 2x2 RGBA texture: 
// [white, black,
// black, white]

// numgl.store_array()'s last 2 args are width and height.
var arrayId = numgl.store_array([255,255,255,255,
								0,0,0,255,
								0,0,0,255,
								255,255,255,255], 
								2, 2);

// show_texture() calls do_it() internally.
numgl.show_texture(arrayId);

```

- Read pixels from canvas

```javascript
// If no width and height are specified, read_canvas() will read the whole canvas.
console.log(numgl.read_canvas().toString());

// Using the above example the result would be: "255,255,255,255,0,0,0,255,0,0,0,255,255,255,255,255"

```

- Flip texture - arrays aren't flipped, but images and videos are by default (texture and clipspace coordinates are different). <a href="http://jsfiddle.net/jongomez/n2gx6986/">JS Fiddle example</a>

```javascript
// Called before numgl.do_it()
numg.textures[storageId].flipTexture = true/false
```

- Manually define fl_FragCoord. <a href="http://jsfiddle.net/jongomez/sbfe1yvz/">JS Fiddle example</a>

```javascript
// Paint the screen blue.
numgl.fragColor = "vec4(0, 0, 1, 1);"
```

- See the generated GLSL code.

```javascript
// Fragment shader code. Vertex shader code function is vs_code().
console.log(numgl.fs_code("pretty"));
```

---

## How does it work

- Video and webcam use requestAnimationFrame so the video/webcam frames are drawn multiple times. Pictures are only drawn once.

- Javascript functions generate GLSL code, and when the user calls numgl.do_it() that GLSL code is compiled and executed. eg:

```javascript
window.onload = function() {
	// "image" is the <img> tag ID.
	var imageId = numgl.store_picture("image");

	numgl.grey(imageId);
	// Console log the GLSL code generated by the numgl.grey() call:
	console.log(numgl.fs_code("pretty"));
}
```

The resulting GLSL code: (uTexture0 is the stored texture - it can be an array, picture or video frame)

```GLSL
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture0;
uniform vec2 uTextureSize0;
varying vec2 vTextCoords;

void main(void) {
	float float_0 = 0.2126 * texture2D(uTexture0, vTextCoords).r;
	float float_1 = 0.7152 * texture2D(uTexture0, vTextCoords).g;
	float float_2 = 0.0722 * texture2D(uTexture0, vTextCoords).b;
	float float_3 = float_0 + float_2 + float_1;
	vec4 vec4_0 = vec4(float_3,float_3,float_3,1);

	gl_FragColor = vec4_0;
 }
```

- The final fragment color (gl_FragColor) is set by these GLSL code creating functions, and can be checked or set manually using numgl.fragColor. <a href="http://jsfiddle.net/jongomez/sbfe1yvz/">JS Fiddle example.</a>

---

### Cross-origin / Same-origin resources

---

- For local images / video, you'll need to set up a local server. It's easy, just open up your console, go to your project's folder and type in ``` python3 -m http.server 8000 ```.

- Images and video from other websites require the inline HTML attribute ``` crossorigin="anonymous" ``` - <a href="http://jsfiddle.net/jongomez/q3n5gj7u/">see the img tag here, for example.</a>

---

### Webcams on Chrome

---

- Webcams only work on https sites if you're using Chrome. On Firefox, webcams should work fine (for now).

