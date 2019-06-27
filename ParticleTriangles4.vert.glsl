#version 410
uniform vec4 VertexRect = vec4(0,0,1,1);
in vec4 Vertex;
out vec4 Rgba;
sampler2D WorldPositions;

uniform mat4 CameraProjectionMatrix;

uniform vec3 LocalPositions[3] = vec3[3](
										vec3( -1,-1,0 ),
										vec3( 1,-1,0 ),
										vec3( 0,1,0 )
										);
#define MAX_COLOUR_COUNT	9
uniform int ColourCount = 0;
uniform vec3 Colours[MAX_COLOUR_COUNT];

uniform float TriangleScale = 0.2;
uniform float SpacingScale = 0.35;

vec3 GetTriangleWorldPos(int TriangleIndex)
{
	float t = float(TriangleIndex);
	//float x = mod( t, 100 ) - (100/2);
	//float y = (t / 100) - (100/2);
	float x = 0;
	float y = 0;
	return vec3( x, y, 0 ) * vec3(SpacingScale,SpacingScale,SpacingScale);
}

vec3 GetTriangleColour(int TriangleIndex)
{
	if ( ColourCount == 0 )
		return vec3(1,0,0);
	
	return Colours[ TriangleIndex % ColourCount];
}

void main()
{
	//int VertexIndex = int(Vertex.x);
	//int TriangleIndex = int(Vertex.y);
	int VertexIndex = int(Vertex.w);
	int TriangleIndex = 0;
	vec3 TriangleWorldPos = Vertex.xyz * 8;

	vec3 LocalPos = LocalPositions[VertexIndex] * TriangleScale;
	vec3 WorldPos = GetTriangleWorldPos(TriangleIndex) + LocalPos;
	vec3 CameraPos = TriangleWorldPos + WorldPos + vec3(0,0,-10);	//	world to camera space
	vec4 ProjectionPos = CameraProjectionMatrix * vec4( CameraPos, 1 );
	gl_Position = ProjectionPos;
	
	Rgba = vec4( GetTriangleColour(TriangleIndex), 1 );
}

