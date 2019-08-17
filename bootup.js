
Pop.Include = function(Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	return Pop.CompileAndRun( Source, Filename );
}

Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');

Pop.Include('AssetManager.js');

const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');
const QuadVertShader = Pop.LoadFileAsString('Quad.vert.glsl');
const ParticleColorShader = Pop.LoadFileAsString('ParticleColour.frag.glsl');
const BlitCopyShader = Pop.LoadFileAsString('BlitCopy.frag.glsl');
const ParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('PhysicsIteration_UpdateVelocity.frag.glsl');
const ParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('PhysicsIteration_UpdatePosition.frag.glsl');
const GeoVertShader = Pop.LoadFileAsString('Geo.vert.glsl');
const ColourFragShader = Pop.LoadFileAsString('Colour.frag.glsl');

const MeshAssetFileExtension = '.mesh.json';


function GenerateRandomVertexes(OnVertex)
{
	for ( let i=0;	i<10000;	i++ )
	{
		let x = Math.random() - 0.5;
		let y = Math.random() - 0.5;
		let z = Math.random() - 0.5;
		OnVertex(x,y,z);
	}
}

var AutoTriangleIndexes = [];
function GetAutoTriangleIndexes(IndexCount)
{
	let OldLength = AutoTriangleIndexes.length;
	while ( AutoTriangleIndexes.length < IndexCount )
		AutoTriangleIndexes.push( AutoTriangleIndexes.length );
	if ( OldLength != AutoTriangleIndexes.length )
		Pop.Debug("New AutoTriangleIndexes.length", AutoTriangleIndexes.length);
	
	//	slice so we don't modify our array, but still the length desired
	//	slow?
	return AutoTriangleIndexes.slice( 0, IndexCount );
	/*
	Pop.Debug("auto gen triangles",TriangleCount);
	GeometryAsset.TriangleIndexes = new Int32Array( TriangleCount );
	for ( let t=0;	t<TriangleCount;	t++ )
		GeometryAsset.TriangleIndexes[t] = t;
	*/

}

//	returns a "mesh asset"
function ParseGeometryFromFile(Filename,VertexSkip)
{
	//	auto load cached version
	if ( Pop.FileExists(Filename+MeshAssetFileExtension) )
	{
		Pop.Debug("Found cached version of " + Filename);
		Filename += MeshAssetFileExtension;
	}
	
	if ( Filename.endsWith(MeshAssetFileExtension) )
	{
		const Contents = Pop.LoadFileAsString( Filename );
		const Asset = JSON.parse( Contents );
		return Asset;
	}
	
	Pop.Debug("Loading " + Filename);
	//	parse files!
	let VertexSize = 2;
	let VertexData = 'auto_vt';
	let VertexDataCount = 0;
	let TriangleIndexes = 'auto';
	let TriangleIndexCount = 0;
	let WorldPositions = [];
	let WorldPositionsCount = 0;
	let WorldPositionSize = 3;
	let WorldMin = [null,null,null];
	let WorldMax = [null,null,null];
	
	let PushTriangleIndex = function(Indexa,Indexb,Indexc)
	{
		//	todo; check out of order?
		if ( TriangleIndexes == 'auto' )
			return;
		TriangleIndexes.push(Indexa);
		TriangleIndexes.push(Indexb);
		TriangleIndexes.push(Indexc);
	}
	let PushVertexData = function(f)
	{
		if ( Array.isArray(VertexData) )
			VertexData.push(f);
		VertexDataCount++;
	}
	let GetVertexDataLength = function()
	{
		if ( Array.isArray(VertexData) )
			return VertexData.length;
		return VertexDataCount;
	}
	let PushWorldPos = function(x,y,z)
	{
		WorldPositions.push([x,y,z]);
	}
	
	let OnMeta = function(Meta)
	{
		
	}
	
	let AddTriangle = function(TriangleIndex,x,y,z)
	{
		let FirstTriangleIndex = GetVertexDataLength() / VertexSize;
		
		if ( VertexSize == 2 )
		{
			if ( VertexData != 'auto_vt' )
			{
				let Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
				Verts.forEach( v => PushVertexData(v) );
			}
		}
		else if ( VertexSize == 4 )
		{
			let Verts = [	x,y,z,0,	x,y,z,1,	x,y,z,2	];
			Verts.forEach( v => PushVertexData(v) );
		}
		
		PushTriangleIndex( FirstTriangleIndex+0, FirstTriangleIndex+1, FirstTriangleIndex+2 );
	}
	
	let VertexCounter = 0;
	let OnVertex = function(x,y,z)
	{
		if ( VertexCounter++ % (VertexSkip+1) > 0 )
			return;
		
		/*
		 if ( TriangleCounter == 0 )
		 {
		 WorldMin = [x,y,z];
		 WorldMax = [x,y,z];
		 }
		 */
		AddTriangle( TriangleIndexCount,x,y,z );
		TriangleIndexCount++;
		PushWorldPos( x,y,z );
		/*
		 WorldMin[0] = Math.min( WorldMin[0], x );
		 WorldMin[1] = Math.min( WorldMin[1], y );
		 WorldMin[2] = Math.min( WorldMin[2], z );
		 WorldMax[0] = Math.max( WorldMax[0], x );
		 WorldMax[1] = Math.max( WorldMax[1], y );
		 WorldMax[2] = Math.max( WorldMax[2], z );
		 */
	}
	
	//let LoadTime = Pop.GetTimeNowMs();
	if ( Filename.endsWith('.ply') )
		Pop.ParsePlyFile(Filename,OnVertex,OnMeta);
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile(Filename,OnVertex,OnMeta);
	else if ( Filename.endsWith('.random') )
		GenerateRandomVertexes(OnVertex);
	else
		throw "Don't know how to load " + Filename;
	
	
	let Asset = {};
	Asset.VertexAttributeName = "Vertex";
	Asset.VertexSize = VertexSize;
	Asset.TriangleIndexes = TriangleIndexes;
	Asset.VertexBuffer = VertexData;
	Asset.WorldPositions = WorldPositions;
	Asset.WorldPositionSize = WorldPositionSize;
	
	return Asset;
}

function VerifyGeometryAsset(Asset)
{
	if ( typeof Asset.VertexAttributeName != 'string' )
		throw "Asset.VertexAttributeName not a string: " + Asset.VertexAttributeName;
	
	if ( typeof Asset.VertexSize != 'number' )
		throw "Asset.VertexSize not a number: " + Asset.VertexSize;
	
	if ( !Array.isArray(Asset.TriangleIndexes) && Asset.TriangleIndexes != 'auto' )
		throw "Asset.TriangleIndexes not an array: " + Asset.TriangleIndexes;
	
	if ( Asset.VertexBuffer != 'auto_vt' )
		if ( !Array.isArray(Asset.VertexBuffer) )
			throw "Asset.VertexBuffer not an array: " + Asset.VertexBuffer;
	
	if ( Asset.WorldPositions !== undefined )
		if ( !Array.isArray(Asset.WorldPositions) )
			throw "Asset.WorldPositions not an array: " + Asset.WorldPositions;

}

function LoadGeometryFromFile(RenderTarget,Filename,WorldPositionImage,Scale,VertexSkip=0,GetIndexMap=null)
{
	const GeometryAsset = ParseGeometryFromFile( Filename, VertexSkip );
	VerifyGeometryAsset( GeometryAsset );
	
	//	auto cache some!
	if ( Filename.endsWith('.ply') )
	{
		const CachedFilename = Filename+MeshAssetFileExtension;
		if ( Pop.FileExists && !Pop.FileExists(CachedFilename) )
		{
			try
			{
				const GeoAssetJson = JSON.stringify( GeometryAsset );
				Pop.WriteStringToFile( Filename + MeshAssetFileExtension, GeoAssetJson );
			}
			catch(e)
			{
				Pop.Debug(e);
			}
		}
	}
	
	//Pop.Debug("Loading took", Pop.GetTimeNowMs()-LoadTime);
	let WorldPositionSize = GeometryAsset.WorldPositionSize;
	let WorldPositions = GeometryAsset.WorldPositions;
	
	if ( WorldPositionImage )
	{
		//	sort, but consistently
		if ( GetIndexMap )
		{
			let Map = GetIndexMap(WorldPositions);
			let NewPositions = [];
			Map.forEach( i => NewPositions.push(WorldPositions[i]) );
			WorldPositions = NewPositions;
		}
		
		let Unrolled = [];
		WorldPositions.forEach( xyz => {	Unrolled.push(xyz[0]);	Unrolled.push(xyz[1]);	Unrolled.push(xyz[2]);}	);
		WorldPositions = Unrolled;
		
		//let WorldPosTime = Pop.GetTimeNowMs();

		Scale = Scale||1;
		let Channels = 3;
		let Quantisise = false;
	
		let NormaliseCoordf = function(x,Index)
		{
			x *= Scale;
			return x;
		}
		
		const Width = 1024;
		const Height = Math.ceil( WorldPositions.length / WorldPositionSize / Width );
		let WorldPixels = new Float32Array( Channels * Width*Height );
		//WorldPositions.copyWithin( WorldPixels );
		
		let ModifyXyz = function(Index)
		{
			Index *= Channels;
			let x = WorldPixels[Index+0];
			let y = WorldPixels[Index+1];
			let z = WorldPixels[Index+2];
			//	normalize and turn into 0-255
			x = Quantisise ? Math.Range( WorldMin[0], WorldMax[0], x ) : x;
			y = Quantisise ? Math.Range( WorldMin[1], WorldMax[1], y ) : y;
			z = Quantisise ? Math.Range( WorldMin[2], WorldMax[2], z ) : z;
			x = NormaliseCoordf(x);
			y = NormaliseCoordf(y);
			z = NormaliseCoordf(z);
			//Pop.Debug(WorldMin,WorldMax,x,y,z);
			WorldPixels[Index+0] = x;
			WorldPixels[Index+1] = y;
			WorldPixels[Index+2] = z;
		}
	
		let PushPixel = function(xyz,Index)
		{
			WorldPixels[Index*Channels+0] = xyz[0];
			WorldPixels[Index*Channels+1] = xyz[1];
			WorldPixels[Index*Channels+2] = xyz[2];
			ModifyXyz( Index );
		}
		for ( let i=0;	i<WorldPositions.length;	i+=WorldPositionSize )
		{
			PushPixel( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		//	ModifyXyz( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		}
		
		//Pop.Debug("Making world positions took", Pop.GetTimeNowMs()-WorldPosTime);

		//let WriteTime = Pop.GetTimeNowMs();
		WorldPositionImage.WritePixels( Width, Height, WorldPixels, 'Float'+Channels );
		//Pop.Debug("Making world texture took", Pop.GetTimeNowMs()-WriteTime);
	}
	
	//	auto generated vertexes
	if ( GeometryAsset.VertexBuffer == 'auto_vt' )
	{
		Pop.Debug("Auto generating vertex buffer ", GeometryAsset.VertexBuffer);
		if ( GeometryAsset.VertexSize != 2 )
			throw "Expected vertex size of 2 (not " + GeometryAsset.VertexSize + ") for " + GeometryAsset.VertexBuffer;
		
		//	need to work out triangle count...
		const TriangleCount = GeometryAsset.WorldPositions.length;
		
		//	gr: we can cache this like GetAutoTriangleIndexes
		GeometryAsset.VertexBuffer = new Float32Array( GeometryAsset.VertexSize * TriangleCount * 3 );
		for ( let t=0;	t<TriangleCount;	t++ )
		{
			for ( let v=0;	v<3;	v++ )
			{
				let Index = t * 3;
				Index += v;
				Index *= GeometryAsset.VertexSize;
				GeometryAsset.VertexBuffer[Index+0] = v;
				GeometryAsset.VertexBuffer[Index+1] = t;
			}
		}
	}
	
	//	auto generated triangles
	if ( GeometryAsset.TriangleIndexes == 'auto' )
	{
		const TriangleCount = GeometryAsset.VertexBuffer.length / GeometryAsset.VertexSize;
		GeometryAsset.TriangleIndexes = GetAutoTriangleIndexes( TriangleCount );
	}
	
	//	loads much faster as a typed array
	GeometryAsset.VertexBuffer = new Float32Array( GeometryAsset.VertexBuffer );
	GeometryAsset.TriangleIndexes = new Int32Array( GeometryAsset.TriangleIndexes );
	
	//let CreateBufferTime = Pop.GetTimeNowMs();
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, GeometryAsset.VertexAttributeName, GeometryAsset.VertexBuffer, GeometryAsset.VertexSize, GeometryAsset.TriangleIndexes );
	//Pop.Debug("Making triangle buffer took", Pop.GetTimeNowMs()-CreateBufferTime);
	
	return TriangleBuffer;
}


//	todo: tie with render target!
let QuadGeometry = null;
function GetQuadGeometry(RenderTarget)
{
	if ( QuadGeometry )
		return QuadGeometry;

	let VertexSize = 2;
	let l = 0;
	let t = 0;
	let r = 1;
	let b = 1;
	//let VertexData = [	l,t,	r,t,	r,b,	l,b	];
	let VertexData = [	l,t,	r,t,	r,b,	r,b, l,b, l,t	];
	let TriangleIndexes = [0,1,2,	2,3,0];
	
	const VertexAttributeName = "TexCoord";

	QuadGeometry = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return QuadGeometry;
}



function UnrollHexToRgb(Hexs)
{
	let Rgbs = [];
	let PushRgb = function(Hex)
	{
		let Rgb = Pop.Colour.HexToRgb(Hex);
		Rgbs.push( Rgb[0]/255 );
		Rgbs.push( Rgb[1]/255 );
		Rgbs.push( Rgb[2]/255 );
	}
	Hexs.forEach( PushRgb );
	return Rgbs;
}

//	colours from colorbrewer2.org
const OceanColoursHex = ['#c9e7f2','#4eb3d3','#2b8cbe','#0868ac','#084081','#023859','#03658c','#218da6','#17aebf','#15bfbf'];
const DebrisColoursHex = ['#084081','#0868ac'];
//const OceanColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
const OceanColours = UnrollHexToRgb(OceanColoursHex);
const ShellColoursHex = [0xF2BF5E,0xF28705,0xBF5B04,0x730c02,0xc2ae8f,0x9A7F5F,0xbfb39b,0x5B3920,0x755E47,0x7F6854,0x8B7361,0xBF612A,0xD99873,0x591902,0xA62103];
const ShellColours = UnrollHexToRgb(ShellColoursHex);
const FogColour = Pop.Colour.HexToRgbf(0x000000);
const LightColour = [0.86,0.95,0.94];

const DebrisColours = UnrollHexToRgb(DebrisColoursHex);

let Camera = new Pop.Camera();
Camera.Position = [ 0,0,0 ];
Camera.LookAt = [ 0,0,-1 ];



function TKeyframe(Time,Uniforms)
{
	this.Time = Time;
	this.Uniforms = Uniforms;
}

function LerpValue(a,b,Lerp)
{
	if ( Array.isArray(a) )
		return Math.LerpArray( a, b, Lerp );

	let IsLerpable = ( typeof a == 'number' );

	//	bool, string, object, return previous until we hit next keyframe
	if ( !IsLerpable )
		return (Lerp < 1.0) ? a : b;
	
	//	lerp number
	return Math.Lerp( a, b, Lerp );
}

function TTimeline(OrigKeyframes)
{
	//	gr: Expecting time to be sorted
	this.Keyframes = OrigKeyframes;

	this.Constructor = function()
	{
		this.FillKeyframes();
	}
	
	this.EnumAllUniforms = function()
	{
		//	keyed list and their first & last keyframe time
		let Uniforms = {};
		
		let EnumUniforms = function(Keyframe)
		{
			let EnumUniform = function(Uniform)
			{
				//	init new uniform
				if ( !Uniforms.hasOwnProperty(Uniform) )
				{
					Uniforms[Uniform] = {};
					Uniforms[Uniform].FirstKeyframeTime = Keyframe.Time;
					Uniforms[Uniform].LastKeyframeTime = null;
				}
				//	update existing uniform
				Uniforms[Uniform].LastKeyframeTime = Keyframe.Time;
			}
			Object.keys( Keyframe.Uniforms ).forEach (EnumUniform);
		}
		this.Keyframes.forEach( EnumUniforms );
		
		return Uniforms;
	}
	
	//	any keyframes missing a uniform, we should in-fill
	//	we could do it in the lookup, but doing once might be simpler
	this.FillKeyframes = function()
	{
		//	get list of all uniforms
		const AllUniforms = this.EnumAllUniforms();
		//Pop.Debug( JSON.stringify( AllUniforms,null,'\t' ) );
		
		//	now go through all keyframes and fill gaps
		let FillKeyframe = function(Keyframe)
		{
			let FillUniform = function(UniformName)
			{
				//	already exists
				if ( Keyframe.Uniforms.hasOwnProperty(UniformName) )
					return;
				
				//	fill!
				let KnownUniform = AllUniforms[UniformName];
				if ( Keyframe.Time < KnownUniform.FirstKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.FirstKeyframeTime, UniformName );
				}
				else if ( Keyframe.Time > KnownUniform.LastKeyframeTime )
				{
					Keyframe.Uniforms[UniformName] = this.GetUniform( KnownUniform.LastKeyframeTime, UniformName );
				}
				else
				{
					const Slice = this.GetTimeSliceForUniform( Keyframe.Time, UniformName );
					const PrevValue = this.Keyframes[Slice.StartIndex].Uniforms[UniformName];
					const NextValue = this.Keyframes[Slice.EndIndex].Uniforms[UniformName];
					Keyframe.Uniforms[UniformName] = LerpValue( PrevValue, NextValue, Slice.Lerp );
				}
			}
			Object.keys(AllUniforms).forEach(FillUniform.bind(this));
		}
		this.Keyframes.forEach( FillKeyframe.bind(this) );
					
		//Pop.Debug( "Filled keyframes", JSON.stringify(this.Keyframes,null,'\t') );
	}

	this.GetTimeSliceForUniform = function(Time,UniformName)
	{
		let Slice = {};
		Slice.StartIndex = undefined;
		Slice.EndIndex = undefined;
		
		for ( let i=0;	i<this.Keyframes.length;	i++ )
		{
			const Keyframe = this.Keyframes[i];
			if ( !Keyframe.Uniforms.hasOwnProperty(UniformName) )
				continue;
			
			//	find the latest keyframe that this could be
			if ( Keyframe.Time <= Time )
			{
				Slice.StartIndex = i;
			}
			
			//	find the first keyframe this could be
			if ( Slice.EndIndex === undefined && Keyframe.Time >= Time )
			{
				Slice.EndIndex = i;
			}
		}
		if ( Slice.StartIndex === undefined && Slice.EndIndex === undefined )
			throw "Uniform " + UniformName + " not found";
		//	there was only one match
		if ( Slice.EndIndex === undefined )
			Slice.EndIndex = Slice.StartIndex;
		if ( Slice.StartIndex === undefined )
			Slice.StartIndex = Slice.EndIndex;

		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	this.GetTimeSlice = function(Time)
	{
		let Slice = {};
		Slice.StartIndex = 0;
		
		for ( let i=0;	i<this.Keyframes.length-1;	i++ )
		{
			let t = this.Keyframes[i].Time;
			if ( t > Time )
			{
				//Pop.Debug( "Time > t", Time, t);
				break;
			}
			Slice.StartIndex = i;
		}
		Slice.EndIndex = Slice.StartIndex+1;
		
		let StartTime = this.Keyframes[Slice.StartIndex].Time;
		let EndTime = this.Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	this.GetUniform = function(Time,Key)
	{
		let Slice = this.GetTimeSliceForUniform( Time, Key );
		const UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		const UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;

		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			
			let Value = LerpValue( a, b, Slice.Lerp );
			return Value;
		}
		let Value = LerpUniform( Key );
		return Value;
	}
	
	this.EnumUniforms = function(Time,EnumUniform)
	{
		let Slice = this.GetTimeSlice( Time );
		let UniformsA = this.Keyframes[Slice.StartIndex].Uniforms;
		let UniformsB = this.Keyframes[Slice.EndIndex].Uniforms;
		let UniformKeys = Object.keys(UniformsA);
		
		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			let Value;
			
			if ( Array.isArray(a) )
				Value = Math.LerpArray( a, b, Slice.Lerp );
			else
				Value = Math.Lerp( a, b, Slice.Lerp );

			//Pop.Debug(Key, Value);
			EnumUniform( Key, Value );
		}
		UniformKeys.forEach( LerpUniform );
	}
	
	this.Constructor();
}

function PhysicsIteration(RenderTarget,Time,PositionTexture,VelocityTexture,ScratchTexture)
{
	if ( !Params.EnablePhysicsIteration )
		return;
	
	let CopyShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	let UpdateVelocityShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdateVelocity, QuadVertShader );
	let UpdatePositionsShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdatePosition, QuadVertShader );
	let Quad = GetQuadGeometry(RenderTarget);
	
	//	copy old velocitys
	let CopyVelcoityToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',VelocityTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyVelcoityToScratch );
	
	//	update velocitys
	let UpdateVelocitys = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('NoiseScale', 0.1 );
			Shader.SetUniform('Gravity', -0.1);
			Shader.SetUniform('Noise', RandomTexture);
			Shader.SetUniform('LastVelocitys',ScratchTexture);
			
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		}
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	
	//	copy old positions
	let CopyPositionsToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',PositionTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyPositionsToScratch );
	
	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('Velocitys',VelocityTexture);
			Shader.SetUniform('LastPositions',ScratchTexture);
			
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionsShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdatePositions );
	
}




function TPhysicsActor(Meta)
{
	this.Position = Meta.Position;
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Meta = Meta;
	
	this.IndexMap = null;
	this.GetIndexMap = function(Positions)
	{
		//	generate
		if ( !this.IndexMap )
		{
			//	add index to each position
			let SetIndex = function(Element,Index)
			{
				Element.push(Index);
			}
			Positions.forEach( SetIndex );
			
			//	sort the positions
			let SortPosition = function(a,b)
			{
				if ( a[2] < b[2] )	return -1;
				if ( a[2] > b[2] )	return 1;
				return 0;
			}
			Positions.sort(SortPosition);
			
			//	extract new index map
			this.IndexMap = [];
			Positions.forEach( xyzi => this.IndexMap.push(xyzi[3]) );
		}
		return this.IndexMap;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget)
	{
		//	need data initialised
		this.GetTriangleBuffer(RenderTarget);
		
		//Pop.Debug("PhysicsIteration", JSON.stringify(this) );
		PhysicsIteration( RenderTarget, Time, this.PositionTexture, this.VelocityTexture, this.ScratchTexture );
	}
	
	this.ResetPhysicsTextures = function()
	{
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float3');
		this.ScratchTexture = new Pop.Image(Size,'Float3');
	}
	
	this.GetPositionsTexture = function()
	{
		return this.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return this.VelocityTexture;
	}

	this.GetTriangleBuffer = function(RenderTarget)
	{
		if ( this.TriangleBuffer )
			return this.TriangleBuffer;
		
		this.PositionTexture = new Pop.Image();
		this.TriangleBuffer = LoadGeometryFromFile( RenderTarget, Meta.Filename, this.PositionTexture, Meta.Scale, Meta.VertexSkip, this.GetIndexMap.bind(this) );
		this.ResetPhysicsTextures();
		
		return this.TriangleBuffer;
	}
	
	this.GetTransformMatrix = function()
	{
		//Pop.Debug("physics pos", JSON.stringify(this));
		return Math.CreateTranslationMatrix( ...this.Position );
	}
}

function TAnimationBuffer(Filenames,Scale)
{
	this.Frames = null;
	
	this.Init = function(RenderTarget)
	{
		if ( this.Frames )
			return;
		
		let LoadFrame = function(Filename,Index)
		{
			let FrameDuration = 1/20;
			let Frame = {};
			Frame.Time = Index * FrameDuration;
			Frame.PositionTexture = new Pop.Image();
			Frame.TriangleBuffer = LoadGeometryFromFile( RenderTarget, Filename, Frame.PositionTexture, Scale );
			this.Frames.push(Frame);
		}

		this.Frames = [];
		Filenames.forEach( LoadFrame.bind(this) );
	}
	
	this.GetDuration = function()
	{
		return this.Frames[this.Frames.length-1].Time;
	}
	
	this.GetFrame = function(Time)
	{
		//	auto loop
		Time = Time % this.GetDuration();
		for ( let i=0;	i<this.Frames.length;	i++ )
		{
			let Frame = this.Frames[i];
			if ( Time <= Frame.Time )
				return Frame;
		}
		throw "Failed to find frame for time " + Time;
	}
	
	this.GetTriangleBuffer = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.TriangleBuffer;
	}
	
	this.GetPositionsTexture = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return null;
	}

}


function TAnimatedActor(Meta)
{
	this.Position = Meta.Position;
	this.Animation = new TAnimationBuffer(Meta.Filename,Meta.Scale);
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Time = 0;
	this.Meta = Meta;
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget)
	{
		this.Animation.Init(RenderTarget);
		this.Time = Time;
	}
	
	this.GetTriangleBuffer = function(RenderTarget)
	{
		const tb = this.Animation.GetTriangleBuffer( this.Time );
		return tb;
	}

	this.GetPositionsTexture = function(RenderTarget)
	{
		const tb = this.Animation.GetPositionsTexture( this.Time );
		return tb;
	}
	
	this.GetVelocitysTexture = function(RenderTarget)
	{
		return null;
	}

	this.GetTransformMatrix = function()
	{
		return Math.CreateTranslationMatrix( ...this.Position );
	}
}


function LoadTimeline(Filename)
{
	const Contents = Pop.LoadFileAsString(Filename);
	const FileKeyframes = JSON.parse( Contents );
	const Keyframes = [];
	const PushKeyframe = function(KeyframeTimeKey)
	{
		const Uniforms = FileKeyframes[KeyframeTimeKey];
		const KeyframeTime = parseFloat(KeyframeTimeKey);
		if ( isNaN(KeyframeTime) )
			throw "Key in timeline is not a float: " + KeyframeTimeKey;
		const Keyframe = new TKeyframe( KeyframeTime, Uniforms );
		Keyframes.push( Keyframe );
	}
	Object.keys(FileKeyframes).forEach( PushKeyframe );
	const Timeline = new TTimeline( Keyframes );
	return Timeline;
}







//	scene!

//const SeaWorldPositionsPlyFilename = 'seatest.ply';
//const SeaWorldPositionsPlyFilename = 'Shell/shellSmall.ply';
const SeaWorldPositionsPlyFilename = 'Shell/shellFromBlender.obj';

let ShellMeta = {};
ShellMeta.Filename = 'Shell/shellFromBlender.obj';
ShellMeta.Position = [0,0,-2];
ShellMeta.Scale = 0.9;
ShellMeta.TriangleScale = 0.03;
ShellMeta.Colours = ShellColours;
ShellMeta.VertexSkip = 0;

let DebrisMeta = {};
DebrisMeta.Filename = '.random';
DebrisMeta.Position = [0,-17,0];
DebrisMeta.Scale = 30;
DebrisMeta.TriangleScale = 0.052015;	//	0.0398
DebrisMeta.Colours = DebrisColours;
DebrisMeta.VertexSkip = 0;


let OceanFilenames = [];
//for ( let i=1;	i<=96;	i++ )
for ( let i=1;	i<=4;	i++ )
OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');

let OceanMeta = {};
OceanMeta.Filename = OceanFilenames;
OceanMeta.Position = [0,0,0];
OceanMeta.Scale = 1.0;
OceanMeta.TriangleScale = 0.0148;
OceanMeta.Colours = OceanColours;

let Actor_Shell = new TPhysicsActor( ShellMeta );
let Actor_Ocean = new TAnimatedActor( OceanMeta );
let Actor_Debris = new TPhysicsActor( DebrisMeta );
let RandomTexture = Pop.CreateRandomImage( 1024, 1024 );









const TimelineMinYear = 1860;
const TimelineMaxYear = 2100;

let Params = {};
Params.TimelineYear = TimelineMinYear;
Params.DebugCameraPositionCount = 50;
Params.DebugCameraPositionScale = 0.05;
Params.FogMinDistance = 11.37;
Params.FogMaxDistance = 24.45;
Params.FogColour = FogColour;
Params.LightColour = LightColour;
Params.Ocean_TriangleScale = OceanMeta.TriangleScale;
Params.Debris_TriangleScale = DebrisMeta.TriangleScale;
Params.DebugPhysicsTextures = false;
Params.BillboardTriangles = true;
Params.EnablePhysicsIteration = false;
Params.ShowClippedParticle = false;

let OnParamsChanged = function(Params)
{
	if ( Actor_Ocean )
		Actor_Ocean.Meta.TriangleScale = Params.Ocean_TriangleScale;
	
	if ( Actor_Debris )
		Actor_Debris.Meta.TriangleScale = Params.Debris_TriangleScale;
}

const ParamsWindowRect = [800,20,350,200];
let ParamsWindow = new CreateParamsWindow(Params,OnParamsChanged,ParamsWindowRect);
ParamsWindow.AddParam('TimelineYear',TimelineMinYear,TimelineMaxYear,Math.floor);
ParamsWindow.AddParam('DebugCameraPositionCount',0,200,Math.floor);
ParamsWindow.AddParam('DebugCameraPositionScale',0,1);
ParamsWindow.AddParam('FogColour','Colour');
ParamsWindow.AddParam('LightColour','Colour');
ParamsWindow.AddParam('Ocean_TriangleScale',0,1.2);
ParamsWindow.AddParam('Debris_TriangleScale',0,1.2);
ParamsWindow.AddParam('FogMinDistance',0,30);
ParamsWindow.AddParam('FogMaxDistance',0,100);
ParamsWindow.AddParam('EnablePhysicsIteration');
ParamsWindow.AddParam('DebugPhysicsTextures');
ParamsWindow.AddParam('BillboardTriangles');
ParamsWindow.AddParam('ShowClippedParticle');











function RenderTriangleBufferActor(RenderTarget,Actor,ActorIndex,SetGlobalUniforms,Time)
{
	if ( !Actor )
		return;
	
	const PositionsTexture = Actor.GetPositionsTexture();
	const VelocitysTexture = Actor.GetVelocitysTexture();
	const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	const Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	
	
	//let Geo = GetAsset( Actor.Geometry, RenderTarget );
	//let Shader = Pop.GetShader( RenderTarget, Actor.FragShader, Actor.VertShader );
	const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];

	let SetUniforms = function(Shader)
	{
		SetGlobalUniforms( Shader );

		Shader.SetUniform('LocalToWorldTransform', Actor.GetTransformMatrix() );
		Shader.SetUniform('LocalPositions', LocalPositions );
		Shader.SetUniform('BillboardTriangles', Params.BillboardTriangles );
		Shader.SetUniform('WorldPositions',PositionsTexture);
		Shader.SetUniform('WorldPositionsWidth',PositionsTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PositionsTexture.GetHeight());
		Shader.SetUniform('TriangleScale', Actor.Meta.TriangleScale);
		Shader.SetUniform('Colours',Actor.Colours);
		Shader.SetUniform('ColourCount',Actor.Colours.length/3);
	};
	
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
	
	
	if ( Params.DebugPhysicsTextures )
	{
		let w = 0.2;
		let x = ActorIndex * (w * 1.05);
		let Quad = GetQuadGeometry(RenderTarget);
		let SetDebugPositionsUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0, w, 0.25 ] );
			Shader.SetUniform('Texture',PositionsTexture);
		};
		let SetDebugVelocitysUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0.3, w, 0.25 ] );
			Shader.SetUniform('Texture',VelocitysTexture);
		};
	
		if ( PositionsTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugPositionsUniforms );
		if ( VelocitysTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugVelocitysUniforms );
	}
}


function LoadCameraSpline(Positions)
{
	//	make a new timeline
	const Keyframes = [];
	const CameraPositionUniform = 'CameraPosition';

	for ( let i=0;	i<Positions.length;	i++ )
	{
		let Time = Math.Range( 0, Positions.length-1, i );
		let Year = Math.Lerp( TimelineMinYear, TimelineMaxYear, Time );
		let Uniforms = [];
		Uniforms[CameraPositionUniform] = Positions[i];
		let Keyframe = new TKeyframe( Year, Uniforms );
		Keyframes.push( Keyframe );
	}

	let Timeline = new TTimeline( Keyframes );
	GetCameraTimelineAndUniform = function()
	{
		return [Timeline,CameraPositionUniform];
	}
}

function LoadCameraScene(Filename)
{
	const FileContents = Pop.LoadFileAsString(Filename);
	
	let Scene = [];
	
	let OnSpline = function(SplineNode)
	{
		if ( SplineNode.Name == 'CameraSpline' )
		{
			//	replace the global function
			//	make a new timeline to replace the default camera timeline accessor
			const CameraPath = SplineNode.PathPositions;
			LoadCameraSpline( CameraPath );
			return;
		}
		Pop.Debug("Found spline ", SplineNode.Name);
	}
	
	let OnActor = function(ActorNode)
	{
		if ( ActorNode.Name == 'Ocean_top_surface' && Actor_Ocean )
		{
			//	gr: currently total mismatch with size, so just set y
			Pop.Debug(ActorNode.Name,ActorNode.Position);
			Actor_Ocean.Position[1] = ActorNode.Position[1];
			return;
		}
		
		Pop.Debug("Loading actor", ActorNode.Name);
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
		Actor.Geometry = 'Cube';
		let LocalScale = Math.CreateScaleMatrix(0.1);
		let WorldPos = Math.CreateTranslationMatrix( ...ActorNode.Position );
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPos, LocalScale );
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = ColourFragShader;
		Scene.push( Actor );
	}
	
	Pop.Collada.Parse( FileContents, OnActor, OnSpline );
	
	return Scene;
}


//	default reads from default timeline
let GetCameraTimelineAndUniform = function()
{
	return [Timeline,'Timeline_CameraPosition'];
}

function GetCameraPath()
{
	const TimelineAndUniform = GetCameraTimelineAndUniform();
	const Timeline = TimelineAndUniform[0];
	const CameraUniform = TimelineAndUniform[1];
	const CameraPositions = [];
	for ( let i=0;	i<Params.DebugCameraPositionCount;	i++ )
	{
		let t = i / Params.DebugCameraPositionCount;
		let Year = Math.lerp( TimelineMinYear, TimelineMaxYear, t );
		let Pos = Timeline.GetUniform( Year, CameraUniform );
		CameraPositions.push( Pos );
	}
	return CameraPositions;
}

function GetTimelineCameraPosition(Year)
{
	const TimelineAndUniform = GetCameraTimelineAndUniform();
	const Timeline = TimelineAndUniform[0];
	const CameraUniform = TimelineAndUniform[1];
	let Pos = Timeline.GetUniform( Year, CameraUniform );
	return Pos;
}


//	todo: use generic actor
function TActor(Transform,Geometry,VertShader,FragShader,Uniforms)
{
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.VertShader = VertShader;
	this.FragShader = FragShader;
	this.Uniforms = Uniforms || [];
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const Geo = GetAsset( this.Geometry, RenderTarget );
		const Shader = Pop.GetShader( RenderTarget, this.FragShader, this.VertShader );
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );
			Shader.SetUniform('LocalToWorldTransform', this.LocalToWorldTransform );
		}
		
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms.bind(this) );
	}
}

//	get scene graph
function GetRenderScene(Time)
{
	let Scene = [];
	
	let PushPositionBufferActor = function(Actor)
	{
		Actor.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
		{
			RenderTriangleBufferActor( RenderTarget, this, ActorIndex, SetGlobalUniforms, Time );
		}
		
		const PositionsTexture = Actor.GetPositionsTexture();
		Actor.Uniforms = [];
		Actor.Uniforms['WorldPositions'] = PositionsTexture;
		Actor.Uniforms['WorldPositionsWidth'] = PositionsTexture.GetWidth();
		Actor.Uniforms['WorldPositionsHeight'] = PositionsTexture.GetHeight();
		Actor.Uniforms['TriangleScale']= Actor.Meta.TriangleScale;
		Actor.Uniforms['Colours']= Actor.Colours;
		Actor.Uniforms['ColourCount']= Actor.Colours.length/3;
		//let a = new TActor( )
		Scene.push( Actor );
	}
	/*
	let ShellAlpha = Timeline.GetUniform(Time,'ShellAlpha');
	if ( ShellAlpha > 0.5 )
		PushPositionBufferActor( Actor_Shell );
	*/
	if ( Actor_Debris )	PushPositionBufferActor( Actor_Debris );

	if ( Actor_Ocean )	PushPositionBufferActor( Actor_Ocean );

	
	let PushCameraPosActor = function(Position)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...Position);
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( Actor.LocalToWorldTransform, Math.CreateScaleMatrix(LocalScale) );
		Actor.Geometry = 'Cube';
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = ColourFragShader;
		Scene.push( Actor );
	}
	const CameraPositions = GetCameraPath();
	CameraPositions.forEach( PushCameraPosActor );
	
	CameraScene.forEach( a => Scene.push(a) );
	
	return Scene;
}




var AppTime = 0;

function Render(RenderTarget)
{
	const DurationSecs = 1 / 60;
	//let Time = Math.Range( TimelineMinYear, TimelineMaxYear, Params.TimelineYear );
	let Time = Params.TimelineYear;
	AppTime += DurationSecs;
	
	//	update some stuff from timeline
	Params.FogColour = Timeline.GetUniform( Time, 'FogColour' );
	ParamsWindow.OnParamChanged('FogColour');
	
	//	update physics
	if ( Actor_Shell )
		Actor_Shell.PhysicsIteration( DurationSecs, AppTime, RenderTarget );
	if ( Actor_Ocean )
		Actor_Ocean.PhysicsIteration( DurationSecs, AppTime, RenderTarget );
	if ( Actor_Debris )
		Actor_Debris.PhysicsIteration( DurationSecs, AppTime, RenderTarget );

	RenderTarget.ClearColour( ...Params.FogColour );
	
	const Viewport = RenderTarget.GetRenderTargetRect();
	const CameraProjectionTransform = Camera.GetProjectionMatrix(Viewport);

	//	apply timeline camera pos temporarily and then remove again
	const TimelineCameraPos = GetTimelineCameraPosition(Time);
	Camera.Position = Math.Add3( Camera.Position, TimelineCameraPos );
	Camera.LookAt = Math.Add3( Camera.LookAt, TimelineCameraPos );
	const WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	Camera.Position = Math.Subtract3( Camera.Position, TimelineCameraPos );
	Camera.LookAt = Math.Subtract3( Camera.LookAt, TimelineCameraPos );

	const CameraToWorldTransform = Math.MatrixInverse4x4(WorldToCameraTransform);

	const Scene = GetRenderScene(Time);
	let RenderSceneActor = function(Actor,ActorIndex)
	{
		const SetGlobalUniforms = function(Shader)
		{
			Shader.SetUniform('WorldToCameraTransform', WorldToCameraTransform );
			Shader.SetUniform('CameraToWorldTransform', CameraToWorldTransform );
			Shader.SetUniform('CameraProjectionTransform', CameraProjectionTransform );
			Shader.SetUniform('Fog_MinDistance',Params.FogMinDistance);
			Shader.SetUniform('Fog_MaxDistance',Params.FogMaxDistance);
			Shader.SetUniform('Fog_Colour',Params.FogColour);
			Shader.SetUniform('Light_Colour', Params.LightColour );
			Shader.SetUniform('Light_MinPower', 0.1 );
			Shader.SetUniform('Light_MaxPower', 1.0 );
		
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		
			//	actor specific
			let SetUniform = function(Key)
			{
				let Value = Actor.Uniforms[Key];
				Shader.SetUniform( Key, Value );
			}
			Object.keys( Actor.Uniforms ).forEach( SetUniform );
		}
		
		Actor.Render( RenderTarget, ActorIndex, SetGlobalUniforms, Time );
	}
	Scene.forEach( RenderSceneActor );
	
}



const CameraScene = LoadCameraScene('CameraSpline.dae.json');

const Timeline = LoadTimeline('Timeline.json');



const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

Window.OnMouseDown = function(x,y,Button)
{
	Window.OnMouseMove( x, y, Button, true );
}

Window.OnMouseMove = function(x,y,Button,FirstClick=false)
{
	if ( Button == 0 )
	{
		Camera.OnCameraPanLocal( x, 0, y, FirstClick );
	}
	if ( Button == 2 )
	{
		Camera.OnCameraPanLocal( x, y, 0, FirstClick );
	}
	if ( Button == 1 )
	{
		Camera.OnCameraOrbit( x, y, 0, FirstClick );
	}
}

Window.OnMouseScroll = function(x,y,Button,Delta)
{
	Camera.OnCameraPanLocal( 0, 0, 0, true );
	Camera.OnCameraPanLocal( 0, 0, Delta[1] * -10, false );
}

