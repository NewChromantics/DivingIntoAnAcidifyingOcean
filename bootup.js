
Pop.Include = function(Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	return Pop.CompileAndRun( Source, Filename );
}

Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');


function LoadPlyGeometry(RenderTarget,Filename,WorldPositionImage)
{
	let VertexSize = 2;
	let VertexData = [];
	let TriangleIndexes = [];
	let WorldPositions = [];
	let WorldMin = [null,null,null];
	let WorldMax = [null,null,null];

	let AddTriangle = function(TriangleIndex,x,y,z)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		let Verts;
		if ( VertexSize == 2 )
			Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
		else
			Verts = [	x,y,z,0,	x,y,z,1,	x,y,z,2	];
		Verts.forEach( v => VertexData.push(v) );
		
		let TriangleIndexes = [0,1,2];
		TriangleIndexes.forEach( i => TriangleIndexes.push( i + FirstTriangleIndex ) );
	}
	
	let TriangleCounter = 0;
	let OnVertex = function(x,y,z)
	{
		if ( TriangleCounter == 0 )
		{
			WorldMin = [x,y,z];
			WorldMax = [x,y,z];
		}
		AddTriangle( TriangleCounter,x,y,z );
		TriangleCounter++;
		WorldPositions.push( [x,y,z] );
		WorldMin[0] = Math.min( WorldMin[0], x );
		WorldMin[1] = Math.min( WorldMin[1], y );
		WorldMin[2] = Math.min( WorldMin[2], z );
		WorldMax[0] = Math.max( WorldMax[0], x );
		WorldMax[1] = Math.max( WorldMax[1], y );
		WorldMax[2] = Math.max( WorldMax[2], z );
	}
	
	if ( Filename.endsWith('.ply') )
		Pop.ParsePlyFile(Filename,OnVertex);
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile(Filename,OnVertex);
	else
		throw "Don't know how to load " + Filename;
	
	if ( WorldPositionImage )
	{
		let Channels = 3;
		const Width = 1024;
		const Height = Math.ceil( WorldPositions.length / Width );
		let WorldPixels = new Uint8Array( Channels * Width*Height );
		let PushPixel = function(xyz,Index)
		{
			//	normalize and turn into 0-255
			const x = Math.Range( WorldMin[0], WorldMax[0], xyz[0] );
			const y = Math.Range( WorldMin[1], WorldMax[1], xyz[1] );
			const z = Math.Range( WorldMin[2], WorldMax[2], xyz[2] );
			Index *= Channels;
			//Pop.Debug(WorldMin,WorldMax,xyz);
			WorldPixels[Index+0] = Math.floor(x * 255);
			WorldPixels[Index+1] = Math.floor(y * 255);
			WorldPixels[Index+2] = Math.floor(z * 255);
		}
		WorldPositions.forEach( PushPixel );
		
		WorldPositionImage.WritePixels( Width, Height, WorldPixels, 'RGB' );
		
	}
	
	const VertexAttributeName = "Vertex";
	
	TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return TriangleBuffer;
}


function HexToRgb(HexRgb)
{
	if ( HexRgb[0] != '#' )	throw HexRgb + " doesn't begin with #";
	
	let GetNibble = function(CharIndex)
	{
		let Char = HexRgb.charCodeAt(CharIndex);
		let a = 'a'.charCodeAt(0);
		let zero = '0'.charCodeAt(0);
		let nine = '9'.charCodeAt(0);
		return (Char >= zero && Char <= nine) ? (0+Char-zero) : (10+Char-a);
	}
	
	let a = GetNibble(1);
	let b = GetNibble(2);
	let c = GetNibble(3);
	let d = GetNibble(4);
	let e = GetNibble(5);
	let f = GetNibble(6);
	
	let Red = (a<<4) | b;
	let Green = (c<<4) | d;
	let Blue = (e<<4) | f;
	//Pop.Debug(a,b,c,d,e,f);
	//Pop.Debug(Red,Green,Blue);
	return [Red,Green,Blue];
}

function UnrollHexToRgb(Hexs)
{
	let Rgbs = [];
	let PushRgb = function(Hex)
	{
		let Rgb = HexToRgb(Hex);
		Rgbs.push( Rgb[0]/255 );
		Rgbs.push( Rgb[1]/255 );
		Rgbs.push( Rgb[2]/255 );
	}
	Hexs.forEach( PushRgb );
	return Rgbs;
}

//	colours from colorbrewer2.org
const SeaColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
//const SeaColoursHex = ['#012345','#ffaa99'];
//const SeaColoursHex = ['#f00000'];
const SeaColours = UnrollHexToRgb(SeaColoursHex);

const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');
const ParticleColorShader = Pop.LoadFileAsString('ParticleColour.frag.glsl');



const Spheres =
[
 //	x,y,z,rad,	r,g,b,emission,	shiny,?,?,?	?,?,?,?
 [ 0,0,0,1,		1,0,0,0,		1,0,0,0,	0,0,0,0 ],
];


let Camera = {};
Camera.Position = [ -4,-1.0,-10 ];
Camera.LookAt = [ 0,0,0 ];
Camera.Aperture = 0.1;
Camera.LowerLeftCorner = [0,0,0];
Camera.DistToFocus = 1;
Camera.Horizontal = [0,0,0];
Camera.Vertical = [0,0,0];
Camera.LensRadius = 1;
Camera.Aperture = 0.015;
Camera.VerticalFieldOfView = 45;
Camera.NearDistance = 0.01;
Camera.FarDistance = 100;

function vec3_length(v)
{
	return Math.sqrt(v[0]*v[0] + v[1]*v[1] + v[2]*v[2]);
}

function vec3_squared_length(v)
{
	return v[0]*v[0] + v[1]*v[1] + v[2]*v[2];
}

function vec3_multiply(v1,n)
{
	let x = v1[0] * n;
	let y = v1[1] * n;
	let z = v1[2] * n;
	return [x,y,z];
}

function vec3_multiply_float(v1,n)
{
	let x = v1[0] * n;
	let y = v1[1] * n;
	let z = v1[2] * n;
	return [x,y,z];
}

function vec3_multiply_vec(v1,v2)
{
	let x = v1[0] * v2[0];
	let y = v1[1] * v2[1];
	let z = v1[2] * v2[2];
	return [x,y,z];
}

function vec3_divide(v1,n)
{
	let x = v1[0] / n;
	let y = v1[1] / n;
	let z = v1[2] / n;
	return [x,y,z];
}

function vec3_divide_float(v1,n)
{
	let x = v1[0] / n;
	let y = v1[1] / n;
	let z = v1[2] / n;
	return [x,y,z];
}

function vec3_add_vec(v1,v2)
{
	let x = v1[0] + v2[0];
	let y = v1[1] + v2[1];
	let z = v1[2] + v2[2];
	return [x,y,z];
}

function vec3_subtract_vec(v1, v2)
{
	let x = v1[0] - v2[0];
	let y = v1[1] - v2[1];
	let z = v1[2] - v2[2];
	return [x,y,z];
}

function vec3_subtract_float(v1,n)
{
	let x = v1[0] - n;
	let y = v1[1] - n;
	let z = v1[2] - n;
	return [x,y,z];
}

function unit_vector(v1)
{
	let v_ = vec3_divide_float(v1, vec3_length(v1));
	return v_;
}

function vec3_dot(v1,v2)
{
	return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
}

function vec3_cross(v1,v2)
{
	let x = v1[1] * v2[2] - v1[2] * v2[1];
	let y = - (v1[0] * v2[2] - v1[2] * v2[0]);
	let z = v1[0] * v2[1] - v1[1] * v2[0];
	return [x,y,z];
}

function camera_pos(cam,vup,vfov,aspect,focus_dist)
{
	const M_PI = 3.1415926535897932384626433832795;

	let aperture = cam.Aperture;
	
	cam.LensRadius = aperture / 2.0;
	let theta = vfov * M_PI / 180.0;
	let half_height = Math.tan (theta / 2.0);
	let half_width = aspect * half_height;
	cam.w = unit_vector( vec3_subtract_vec( cam.Position, cam.LookAt ) );
	cam.u = unit_vector( vec3_cross( vup, cam.w ) );
	cam.v = vec3_cross( cam.w, cam.u );
	cam.LowerLeftCorner =
	vec3_subtract_vec(
					  vec3_subtract_vec(
										vec3_subtract_vec( cam.Position,
														  vec3_multiply_float( cam.u, half_width * focus_dist )),
										vec3_multiply_float( cam.v, half_height * focus_dist )),
					  vec3_multiply_float( cam.w, focus_dist ));
	cam.Horizontal  = vec3_multiply_float( cam.u,  2 * half_width * focus_dist );
	cam.Vertical  = vec3_multiply_float( cam.v, 2 * half_height * focus_dist );
}


function perspective(out, fovy, aspect, near, far)
{
	var f = 1.0 / Math.tan( Math.radians(fovy) / 2);
	var nf = 1 / (near - far);
	
	out = out || [];
	out[0] = f / aspect;
	out[1] = 0;
	out[2] = 0;
	out[3] = 0;
	out[4] = 0;
	out[5] = f;
	out[6] = 0;
	out[7] = 0;
	out[8] = 0;
	out[9] = 0;
	out[10] = (far + near) * nf;
	out[11] = -1;
	out[12] = 0;
	out[13] = 0;
	out[14] = 2 * far * near * nf;
	out[15] = 0;
	return out;
}

function UpdateCamera(RenderTarget)
{
	let Rect = RenderTarget.GetScreenRect();
	RenderTarget.GetWidth = function(){	return Rect[2]; };
	RenderTarget.GetHeight = function(){	return Rect[3]; };
	
	Camera.DistToFocus = vec3_length( vec3_subtract_vec( Camera.Position, Camera.LookAt ) );
	
	let Up = [0,1,0];
	let Aspect = RenderTarget.GetWidth() / RenderTarget.GetHeight();
	
	camera_pos( Camera, Up, Camera.VerticalFieldOfView, Aspect, Camera.DistToFocus );
	
	Camera.ProjectionMatrix = perspective( [], Camera.VerticalFieldOfView, Aspect, Camera.NearDistance, Camera.FarDistance );
	
}

function OnCameraPan(x,y,FirstClick)
{
	if ( FirstClick )
		Camera.LastPanPos = [x,y];
	
	let Deltax = Camera.LastPanPos[0] - x;
	let Deltay = Camera.LastPanPos[1] - y;
	Camera.Position[0] -= Deltax * 0.01
	Camera.Position[1] += Deltay * 0.01
	
	Camera.LastPanPos = [x,y];
}

function OnCameraZoom(x,y,FirstClick)
{
	if ( FirstClick )
		Camera.LastZoomPos = [x,y];
	
	let Deltax = Camera.LastZoomPos[0] - x;
	let Deltay = Camera.LastZoomPos[1] - y;
	//Camera.Position[0] -= Deltax * 0.01
	Camera.Position[2] += Deltay * 0.01
	
	Camera.LastZoomPos = [x,y];
}


let TriangleBuffer = null;
let SeaWorldPositionsTexture = null;
let NoiseTexture = new Pop.Image('Noise0.png');
//const SeaWorldPositionsPlyFilename = 'test.ply';
//const SeaWorldPositionsPlyFilename = 'Shell/shellSmall.ply';
const SeaWorldPositionsPlyFilename = 'Shell/shellFromBlender.obj';

function TVertexAttrib(Name,Type)
{
	this.Name = Name;
	this.Type = Type;
}

function GetTriangleBuffer(RenderTarget,TriangleCount)
{
	if ( TriangleBuffer )
		return TriangleBuffer;
	
	SeaWorldPositionsTexture = new Pop.Image();
	TriangleBuffer = LoadPlyGeometry(RenderTarget,SeaWorldPositionsPlyFilename,SeaWorldPositionsTexture);
	return TriangleBuffer;

	let VertexSize = 2;
	let VertexData = [];
	let TriangleIndexes = [];
	
	let AddQuad = function(TL_BR)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		let l = TL_BR[0];
		let t = TL_BR[1];
		let r = TL_BR[2];
		let b = TL_BR[3];

		let Verts = [	l,t,	r,t,	r,b,	l,b	];
		Verts.forEach( v => VertexData.push(v) );

		let QuadIndexes = [0,1,2,	2,3,0];
		QuadIndexes.forEach( i => TriangleIndexes.push( i + FirstTriangleIndex ) );
	}
	
	let AddTriangle = function(TriangleIndex)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		let Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
		Verts.forEach( v => VertexData.push(v) );
		
		let TriangleIndexes = [0,1,2];
		TriangleIndexes.forEach( i => TriangleIndexes.push( i + FirstTriangleIndex ) );
	}
	/*
	AddQuad( [0,0,	1,1	] );
	AddQuad( [0,1.5,	1,2.5	] );
	//let VertexData = [ 0,0,	1,0,	1,1,	0,1	];
	//let TriangleIndexes = [0,1,2,	2,3,0];
	*/
	for ( let i=0;	i<TriangleCount;	i++ )
		AddTriangle(i);
	
	//Pop.Debug( VertexData );
	//Pop.Debug( TriangleIndexes );
	
	const VertexAttributeName = "Vertex";

	TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return TriangleBuffer;
}

function Render(RenderTarget)
{
	RenderTarget.ClearColour( 0,0,0 );
	
	UpdateCamera(RenderTarget);
	
	let WindowSize = [ RenderTarget.GetWidth(), RenderTarget.GetHeight() ];
	let RandomSeed = 0;
	let Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );
	let Time = (Pop.GetTimeNowMs() % 1000) / 1000;

	//let PosTexture = NoiseTexture;
	let PosTexture = SeaWorldPositionsTexture;
	
	let SetUniforms = function(Shader)
	{
		Shader.SetUniform('WorldPositions',PosTexture);
		Shader.SetUniform('WorldPositionsWidth',PosTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PosTexture.GetHeight());
		Shader.SetUniform('Colours',SeaColours);
		Shader.SetUniform('ColourCount',SeaColours.length/3);
		Shader.SetUniform('CameraProjectionMatrix', Camera.ProjectionMatrix );
		Shader.SetUniform('CameraWorldPosition',Camera.Position);
	};

	let TriangleBuffer = GetTriangleBuffer(RenderTarget,100*100);
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
}

let Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

Window.OnMouseDown = function(x,y,Button)
{
	if ( Button == 0 )
		OnCameraPan( x, y, true );
	if ( Button == 1 )
		OnCameraZoom( x, y, true );
}

Window.OnMouseMove = function(x,y,Button)
{
	if ( Button == 0 )
		OnCameraPan( x, y, false );
	if ( Button == 1 )
		OnCameraZoom( x, y, false );
};

