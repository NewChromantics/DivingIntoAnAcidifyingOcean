precision highp float;

uniform sampler2D Texture;
varying vec2 uv;
uniform bool DrawAlpha;

void main()
{
	gl_FragColor = texture( Texture, uv );
	if ( DrawAlpha )
	{
		if ( gl_FragColor.w == 0.0 )
		{
			gl_FragColor = float4( 1,0,0,1 );
		}
		else if ( gl_FragColor.w == 1.0 )
		{
			gl_FragColor = float4( 0,1,0,1 );
		}
		else
		{
			gl_FragColor.x = gl_FragColor.w;
			gl_FragColor.y = gl_FragColor.w;
			gl_FragColor.z = gl_FragColor.w;
			gl_FragColor.w = 1.0;
		}
	}
}

