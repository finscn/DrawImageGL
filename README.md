# DrawImageGL
simulate `drawImage()` of canvas2d with WebGL

----

inspired by https://webglfundamentals.org/webgl/lessons/webgl-2d-drawimage.html

----

```js

const drawGL = new DrawImageGL(canvas);

// clear canvas with color
drawGL.clear(color);

if (imgHasLoaded) {
// as same as canvas2d
    drawGL.drawImage(img,10, 10);
    drawGL.drawImage(img, 300, 10, 100, 100);
    drawGL.drawImage(img, 120, 90,  120, 90, 300, 200, 50, 50);
}


```