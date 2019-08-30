precision highp float;

in float3 FragLocalPosition;
uniform float LineWidth;
const bool DrawAllEdges = true;
uniform bool ChequerFrontAndBack;
uniform bool ChequerSides;

float Range(float Min,float Max,float Value)
{
	return ( Value-Min ) / (Max-Min);
}

float3 Range3(float3 Min,float3 Max,float3 Value)
{
	float x = Range( Min.x, Max.x, Value.x );
	float y = Range( Min.y, Max.y, Value.y );
	float z = Range( Min.z, Max.z, Value.z );
	return float3(x,y,z);
}

uniform mat4 LocalToWorldTransform;

void main()
{
	//float3 LocalPos = Range3( float3(-1,-1,-1), float3(1,1,1), FragLocalPosition );
	//gl_FragColor = float4( LocalPos, 1 );
	
	///if ( LocalPos.x >= 1.0 || LocalPos.y >= 1.0 || LocalPos.z >= 1.0 )
	//	gl_FragColor = float4(0,1,0,1);
	
	//	need to be on edge of the triangles
	float3 LocalPos = Range3( float3(-1,-1,-1), float3(1,1,1), FragLocalPosition );
	//float3 LocalPos = Range3( float3(0,0,0), float3(1,1,1), FragLocalPosition );
	//LocalPos = abs(LocalPos);
	//LocalPos = normalize( LocalPos );
/*
	float4 Far = LocalToWorldTransform * float4(0,0,1.0-LineWidth,0);
	Far.z /= Far.w;
	
	if ( LocalPos.z >= Far.z )
	{
		gl_FragColor = float4( 1,0,0,1 );
		return;
	}
 */
	/*
	if ( LocalPos.z > 0.0 )
	{
		gl_FragColor = float4( LocalPos.z, LocalPos.z, LocalPos.z, 1 );
		//gl_FragColor = float4( 1,1,0,1 );
		return;
	}
	*/
	
	//	z depth scales inversely, so hack: just make the far edge test smaller
	float FarMax = 1.0 - (LineWidth*0.001);
	bool EdgeX = ( LocalPos.x < LineWidth );
	bool EdgeY = ( LocalPos.y < LineWidth );
	bool EdgeZ = ( LocalPos.z < LineWidth );
	bool FarEdgeX = DrawAllEdges && ( LocalPos.x > 1.0-LineWidth );
	bool FarEdgeY = DrawAllEdges && ( LocalPos.y > 1.0-LineWidth );
	bool FarEdgeZ = DrawAllEdges && ( LocalPos.z > FarMax );
	
	int EdgeCount = int(EdgeX) + int(EdgeY) + int(EdgeZ) + int(FarEdgeX) + int(FarEdgeY) + int(FarEdgeZ);

	float3 Axis = LocalPos;
	
	//	chequerboard near near & far planes
	if ( EdgeZ || FarEdgeZ )
	{
		if ( ChequerFrontAndBack )
		{
			float SquareCount = 20.0;
			bool x = mod( LocalPos.x*SquareCount, 1.0 ) > 0.5;
			bool y = mod( LocalPos.y*SquareCount, 1.0 ) > 0.5;
			if ( x == y )
				discard;
			gl_FragColor = float4( Axis,1 );
			return;
		}
	}
	
	if ( EdgeX || FarEdgeX )
	{
		if ( ChequerSides )
		{
			float SquareCount = 20.0;
			bool x = mod( LocalPos.z*SquareCount, 1.0 ) > 0.5;
			bool y = mod( LocalPos.y*SquareCount, 1.0 ) > 0.5;
			if ( x == y )
				discard;
			gl_FragColor = float4( Axis,1 );
			return;
		}
	}
	
	if ( EdgeY || FarEdgeY )
	{
		if ( ChequerSides )
		{
			float SquareCount = 20.0;
			bool x = mod( LocalPos.z*SquareCount, 1.0 ) > 0.5;
			bool y = mod( LocalPos.x*SquareCount, 1.0 ) > 0.5;
			if ( x == y )
				discard;
			gl_FragColor = float4( Axis,1 );
			return;
		}
	}
	
	//	only interested when on the edge of two sides
	if ( EdgeCount < 2 )
		discard;
	
	/*
	if ( EdgeX && EdgeZ )
		Axis = float3(0,1,0);
	else if ( EdgeY && EdgeZ )
		Axis = float3(1,0,0);
	else if ( EdgeX && EdgeY )
		Axis = float3(0,0,1);
	else if ( FarEdgeX && FarEdgeZ )
		Axis = float3(1,0,1);
	else if ( FarEdgeY && FarEdgeZ )
		Axis = float3(0,1,1);
	else if ( FarEdgeX && FarEdgeY )
		Axis = float3(1,1,0);
	else
	{
		//discard;
	}
	*/
	gl_FragColor = float4( Axis, 1 );
}
