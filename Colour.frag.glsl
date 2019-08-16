precision highp float;

in float3 Colour;

void main()
{
	gl_FragColor = float4( Colour, 1 );
}
