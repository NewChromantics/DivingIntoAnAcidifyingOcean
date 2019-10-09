#extension GL_EXT_draw_buffers : require
precision highp float;

uniform sampler2D Texture0;
uniform sampler2D Texture1;
varying vec2 uv;

void main()
{
	gl_FragData[0] = texture2D( Texture0, uv );
	gl_FragData[1] = texture2D( Texture1, uv );
}

