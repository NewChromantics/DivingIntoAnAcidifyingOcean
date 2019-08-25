precision highp float;
varying vec2 TriangleUv;

const float ClipRadius = 0.4;

void main()
{
	//float2 uv = TriangleUv - float2(0.5,0.5);
	float2 uv = TriangleUv;
	//uv *= 2.0;
	float Distance = length(uv);
	if ( Distance > ClipRadius )
		discard;
	Distance /= ClipRadius;
	Distance = min( 1.0, Distance );
	//Distance *= Distance;
	Distance = 1.0 - Distance;
	//gl_FragColor = float4(TriangleUv,0,1);
	gl_FragColor = float4(uv,Distance,Distance);
}

