"use strict";

(function(exports) {

    const vertexShader = `
    attribute vec4 a_position;

    uniform mat4 u_matrix;
    uniform mat4 u_textureMatrix;

    varying vec2 v_texcoord;

    void main() {
     gl_Position = u_matrix * a_position;
     v_texcoord = (u_textureMatrix * a_position).xy;
    }
    `;

    const fragmentShader = `
    precision mediump float;

    varying vec2 v_texcoord;

    uniform sampler2D u_texture;

    void main() {
     gl_FragColor = texture2D(u_texture, v_texcoord);
    }
    `;

    const ShaderType = {
        VERTEX_SHADER: 'VERTEX_SHADER',
        FRAGMENT_SHADER: 'FRAGMENT_SHADER',
    };

    const Mat4Type = Float32Array;

    var tempMat0 = new Mat4Type(16)
    var tempMat1 = new Mat4Type(16)

    var DrawImageGL = function(canvas, options) {
        this.texCache = {}
        if (canvas) {
            this.init(canvas, options);
        }
    };

    var proto = {
        constructor: DrawImageGL,

        canvas: null,
        gl: null,

        vertexShader: null,
        fragmentShader: null,
        program: null,

        positionLocation: null,
        positionBuffer: null,

        matrixLocation: null,
        textureMatrixLocation: null,
        textureLocation: null,

        texCache: null,

        destroy: function() {
            this.texCache = null;
            this.canvas = null;
            this.gl = null;

            this.vertexShader = null;
            this.fragmentShader = null;
            this.program = null;

            this.positionLocation = null;
            this.positionBuffer = null;

            this.matrixLocation = null;
            this.textureMatrixLocation = null;
            this.textureLocation = null;
        },

        init: function(canvas, options) {
            let gl;

            options = Object.assign({
                alpha: false,
                stencil: true,
                depth: true,
                antialias: false,
                preserveDrawingBuffer: false,

                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
            }, options);

            this.vertexShader = options.vertexShader;
            this.fragmentShader = options.fragmentShader;
            delete options.vertexShader;
            delete options.fragmentShader;

            try {
                gl = canvas.getContext('webgl', options) ||
                    canvas.getContext('experimental-webgl', options) ||
                    canvas.getContext('webkit-3d', options) ||
                    canvas.getContext('moz-webgl', options);
            } catch (err) {
                console.error(err);
                throw err;
            }

            this.canvas = canvas;
            this.gl = gl;

            this.initContext(gl);
        },

        initContext(gl, vertexShader, fragmentShader) {
            vertexShader = vertexShader || this.vertexShader
            fragmentShader = fragmentShader || this.fragmentShader
                // setup GLSL program
            this.program = createProgramFromSources(gl, vertexShader, fragmentShader)
            const program = this.program;

            // look up where the vertex data needs to go.
            this.positionLocation = gl.getAttribLocation(program, "a_position");

            // lookup uniforms
            this.matrixLocation = gl.getUniformLocation(program, "u_matrix");
            this.textureMatrixLocation = gl.getUniformLocation(program, "u_textureMatrix");
            this.textureLocation = gl.getUniformLocation(program, "u_texture");

            // Create a buffer.
            this.positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);

            // Put a unit quad in the buffer
            this.positions = new Float32Array([
                0, 0,
                0, 1,
                1, 0,
                1, 0,
                0, 1,
                1, 1,
            ])
            gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);
        },

        resizeCanvas: function(width, height) {
            const canvas = this.canvas;
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                return true;
            }
            return false;
        },

        createTexture: function(img) {
            let tex = this.texCache[img.src];
            if (tex) {
                return tex;
            }

            const gl = this.gl;

            tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            // Fill the texture with a 1x1 blue pixel.
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 255, 255]));

            // let's assume all images are not a power of 2
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

            this.texCache[img.src] = tex;

            return tex;
        },

        clear: function(color) {
            let flags = 0;
            if (color !== undefined) {
                flags |= this.gl.COLOR_BUFFER_BIT;
                this.gl.clearColor(color[0], color[1], color[2], color[3]);
            }
            this.gl.clear(flags);
        },

        drawImage: function(img, srcX, srcY, srcWidth, srcHeight, dstX, dstY, dstWidth, dstHeight) {

            const tex = this.createTexture(img);
            const program = this.program;

            const args = arguments;
            const argCount = args.length;

            const texWidth = img.width
            const texHeight = img.height

            if (argCount === 3) {
                dstX = srcX;
                dstY = srcY;
                srcX = 0;
                srcY = 0;
                srcWidth = texWidth;
                srcHeight = texHeight;
                dstWidth = srcWidth;
                dstHeight = srcHeight;
            } else if (argCount === 5) {
                dstX = srcX;
                dstY = srcY;
                dstWidth = srcWidth;
                dstHeight = srcHeight;
                srcX = 0;
                srcY = 0;
                srcWidth = texWidth;
                srcHeight = texHeight;
            } else if (argCount === 7) {
                dstWidth = srcWidth;
                dstHeight = srcHeight;
            }


            const canvas = this.canvas;
            const gl = this.gl;

            gl.bindTexture(gl.TEXTURE_2D, tex);

            // Tell WebGL to use our shader program pair
            gl.useProgram(program);

            // Setup the attributes to pull data from our buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(this.positionLocation);
            gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

            // this matrix will convert from pixels to clip space
            let matrix = Mat4Orthographic(0, gl.canvas.width, gl.canvas.height, 0, -1, 1, tempMat0);

            // this matrix will translate our quad to dstX, dstY
            matrix = Mat4Translate(matrix, dstX, dstY, 0, tempMat1);

            // this matrix will scale our 1 unit quad
            // from 1 unit to texWidth, texHeight units
            matrix = Mat4Scale(matrix, dstWidth, dstHeight, 1, tempMat0);

            // Set the matrix.
            gl.uniformMatrix4fv(this.matrixLocation, false, matrix);

            // Because texture coordinates go from 0 to 1
            // and because our texture coordinates are already a unit quad
            // we can select an area of the texture by scaling the unit quad
            // down
            let texMatrix = Mat4Translation(srcX / texWidth, srcY / texHeight, 0, tempMat1);
            if (srcWidth !== texWidth || srcHeight !== texHeight) {
                texMatrix = Mat4Scale(texMatrix, srcWidth / texWidth, srcHeight / texHeight, 1, tempMat0);
            }

            // Set the texture matrix.
            gl.uniformMatrix4fv(this.textureMatrixLocation, false, texMatrix);

            // Tell the shader to get the texture from texture unit 0
            gl.uniform1i(this.textureLocation, 0);

            // draw the quad (2 triangles, 6 vertices)
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        }

    };

    for (let p in proto) {
        DrawImageGL.prototype[p] = proto[p];
    }
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////

    function Mat4Translate(m, tx, ty, tz, dst) {
        // This is the optimized version of
        // return multiply(m, translation(tx, ty, tz), dst);
        dst = dst || new Mat4Type(16);

        var m00 = m[0];
        var m01 = m[1];
        var m02 = m[2];
        var m03 = m[3];
        var m10 = m[1 * 4 + 0];
        var m11 = m[1 * 4 + 1];
        var m12 = m[1 * 4 + 2];
        var m13 = m[1 * 4 + 3];
        var m20 = m[2 * 4 + 0];
        var m21 = m[2 * 4 + 1];
        var m22 = m[2 * 4 + 2];
        var m23 = m[2 * 4 + 3];
        var m30 = m[3 * 4 + 0];
        var m31 = m[3 * 4 + 1];
        var m32 = m[3 * 4 + 2];
        var m33 = m[3 * 4 + 3];

        if (m !== dst) {
            dst[0] = m00;
            dst[1] = m01;
            dst[2] = m02;
            dst[3] = m03;
            dst[4] = m10;
            dst[5] = m11;
            dst[6] = m12;
            dst[7] = m13;
            dst[8] = m20;
            dst[9] = m21;
            dst[10] = m22;
            dst[11] = m23;
        }

        dst[12] = m00 * tx + m10 * ty + m20 * tz + m30;
        dst[13] = m01 * tx + m11 * ty + m21 * tz + m31;
        dst[14] = m02 * tx + m12 * ty + m22 * tz + m32;
        dst[15] = m03 * tx + m13 * ty + m23 * tz + m33;

        return dst;
    }

    function Mat4Scale(m, sx, sy, sz, dst) {
        // This is the optimized version of
        // return multiply(m, scaling(sx, sy, sz), dst);
        dst = dst || new Mat4Type(16);

        dst[0] = sx * m[0 * 4 + 0];
        dst[1] = sx * m[0 * 4 + 1];
        dst[2] = sx * m[0 * 4 + 2];
        dst[3] = sx * m[0 * 4 + 3];
        dst[4] = sy * m[1 * 4 + 0];
        dst[5] = sy * m[1 * 4 + 1];
        dst[6] = sy * m[1 * 4 + 2];
        dst[7] = sy * m[1 * 4 + 3];
        dst[8] = sz * m[2 * 4 + 0];
        dst[9] = sz * m[2 * 4 + 1];
        dst[10] = sz * m[2 * 4 + 2];
        dst[11] = sz * m[2 * 4 + 3];

        if (m !== dst) {
            dst[12] = m[12];
            dst[13] = m[13];
            dst[14] = m[14];
            dst[15] = m[15];
        }

        return dst;
    }

    function Mat4Translation(tx, ty, tz, dst) {
        dst = dst || new Mat4Type(16);

        dst[0] = 1;
        dst[1] = 0;
        dst[2] = 0;
        dst[3] = 0;
        dst[4] = 0;
        dst[5] = 1;
        dst[6] = 0;
        dst[7] = 0;
        dst[8] = 0;
        dst[9] = 0;
        dst[10] = 1;
        dst[11] = 0;
        dst[12] = tx;
        dst[13] = ty;
        dst[14] = tz;
        dst[15] = 1;

        return dst;
    }

    function Mat4Orthographic(left, right, bottom, top, near, far, dst) {
        dst = dst || new Mat4Type(16);

        dst[0] = 2 / (right - left);
        dst[1] = 0;
        dst[2] = 0;
        dst[3] = 0;
        dst[4] = 0;
        dst[5] = 2 / (top - bottom);
        dst[6] = 0;
        dst[7] = 0;
        dst[8] = 0;
        dst[9] = 0;
        dst[10] = 2 / (near - far);
        dst[11] = 0;
        dst[12] = (left + right) / (left - right);
        dst[13] = (bottom + top) / (bottom - top);
        dst[14] = (near + far) / (near - far);
        dst[15] = 1;

        return dst;
    }

    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////


    function createProgramFromSources(gl, vertexShader, fragmentShader, opt_attribs, opt_locations) {
        const vs = loadShader(gl, vertexShader, gl.VERTEX_SHADER)
        const fs = loadShader(gl, fragmentShader, gl.FRAGMENT_SHADER)
        return createProgram(gl, vs, fs, opt_attribs, opt_locations);
    }

    function loadShader(gl, shaderSource, shaderType) {
        // Create the shader object
        const shader = gl.createShader(shaderType);
        // Load the shader source
        gl.shaderSource(shader, shaderSource);

        // Compile the shader
        gl.compileShader(shader);

        // Check the compile status
        const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (!compiled) {
            // Something went wrong during compilation; get the error
            const lastError = gl.getShaderInfoLog(shader);
            console.error('*** Error compiling shader \'' + shader + '\':' + lastError + `\n` + shaderSource.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n'));
            gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    function createProgram(gl, vertexShader, fragmentShader, opt_attribs, opt_locations) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        if (opt_attribs) {
            opt_attribs.forEach(function(attrib, ndx) {
                gl.bindAttribLocation(
                    program,
                    opt_locations ? opt_locations[ndx] : ndx,
                    attrib);
            });
        }
        gl.linkProgram(program);

        // Check the link status
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (!linked) {
            // something went wrong with the link
            const lastError = gl.getProgramInfoLog(program);
            console.error('Error in program linking:' + lastError);

            gl.deleteProgram(program);
            return null;
        }
        return program;
    }

    if (exports) {
        exports.DrawImageGL = DrawImageGL;
    }

    if (typeof module !== "undefined") {
        module.exports = DrawImageGL;
    }

})(typeof window !== 'undefined' ? window : typeof process === 'object' && typeof require === 'function' && typeof global === 'object' ? global : this);
