Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopTexture.js');

const BlitCopyShader = Pop.LoadFileAsString('BlitCopy.frag.glsl');
const ParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('PhysicsIteration_UpdateVelocity.frag.glsl');
const ParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('PhysicsIteration_UpdatePosition.frag.glsl');
const QuadVertShader = Pop.LoadFileAsString('Quad.vert.glsl');
const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');

const MeshAssetFileExtension = '.mesh.json';

const RandomTexture = Pop.CreateRandomImage( 1024, 1024 );


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

var Auto_auto_vt_Buffer = [];
function GetAuto_AutoVtBuffer(TriangleCount)
{
	const VertexSize = 2;
	const IndexCount = VertexSize * TriangleCount * 3;
	while ( Auto_auto_vt_Buffer.length < IndexCount )
	{
		let t = Auto_auto_vt_Buffer.length / VertexSize / 3;
		for ( let v=0;	v<3;	v++ )
		{
			let Index = t * 3;
			Index += v;
			Index *= VertexSize;
			Auto_auto_vt_Buffer[Index+0] = v;
			Auto_auto_vt_Buffer[Index+1] = t;
		}
	}
	//Pop.Debug('Auto_auto_vt_Buffer',Auto_auto_vt_Buffer);
	return new Float32Array( Auto_auto_vt_Buffer, 0, IndexCount );
}

function CreateCubeGeometry(RenderTarget,Min=-1,Max=1)
{
	let VertexSize = 3;
	let VertexData = [];
	let TriangleIndexes = [];
	
	let AddTriangle = function(a,b,c)
	{
		let FirstTriangleIndex = VertexData.length / VertexSize;
		
		a.forEach( v => VertexData.push(v) );
		b.forEach( v => VertexData.push(v) );
		c.forEach( v => VertexData.push(v) );
		
		TriangleIndexes.push( FirstTriangleIndex+0 );
		TriangleIndexes.push( FirstTriangleIndex+1 );
		TriangleIndexes.push( FirstTriangleIndex+2 );
	}
	
	let tln = [Min,Min,Min];
	let trn = [Max,Min,Min];
	let brn = [Max,Max,Min];
	let bln = [Min,Max,Min];
	let tlf = [Min,Min,Max];
	let trf = [Max,Min,Max];
	let brf = [Max,Max,Max];
	let blf = [Min,Max,Max];
	
	
	//	near
	AddTriangle( tln, trn, brn );
	AddTriangle( brn, bln, tln );
	//	far
	AddTriangle( trf, tlf, blf );
	AddTriangle( blf, brf, trf );
	
	//	top
	AddTriangle( tln, tlf, trf );
	AddTriangle( trf, trn, tln );
	//	bottom
	AddTriangle( bln, blf, brf );
	AddTriangle( brf, brn, bln );
	
	//	left
	AddTriangle( tlf, tln, bln );
	AddTriangle( bln, blf, tlf );
	//	right
	AddTriangle( trn, trf, brf );
	AddTriangle( brf, brn, trn );
	
	const VertexAttributeName = "LocalPosition";
	
	//	loads much faster as a typed array
	VertexData = new Float32Array( VertexData );
	TriangleIndexes = new Int32Array(TriangleIndexes);
	
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return TriangleBuffer;
}



var Assets = [];
var AssetFetchFunctions = [];
AssetFetchFunctions['Cube'] = CreateCubeGeometry;
AssetFetchFunctions['SmallCube'] = function(rt)	{	return CreateCubeGeometry(rt,-0.1,0.1);	};
AssetFetchFunctions['Cube01'] = function(rt)	{	return CreateCubeGeometry(rt,0,1);	};


function GetAsset(Name,RenderContext)
{
	let ContextKey = GetUniqueHash( RenderContext );
	if ( !Assets.hasOwnProperty(ContextKey) )
		Assets[ContextKey] = [];
	
	let ContextAssets = Assets[ContextKey];
	
	if ( ContextAssets.hasOwnProperty(Name) )
		return ContextAssets[Name];
	
	if ( !AssetFetchFunctions.hasOwnProperty(Name) )
		throw "No known asset named "+ Name;
	
	ContextAssets[Name] = AssetFetchFunctions[Name]( RenderContext );
	return ContextAssets[Name];
}





function TPhysicsActor(Meta)
{
	this.Position = Meta.Position;
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Meta = Meta;
	
	if ( !this.Meta.UpdateVelocityShader )
		this.Meta.UpdateVelocityShader = ParticlePhysicsIteration_UpdateVelocity;
	if ( !this.Meta.UpdatePositionShader )
		this.Meta.UpdatePositionShader = ParticlePhysicsIteration_UpdatePosition;
	
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
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
		//	need data initialised
		this.GetTriangleBuffer(RenderTarget);
		
		//Pop.Debug("PhysicsIteration", JSON.stringify(this) );
		//	pause/dont run
		if ( DurationSecs == 0 )
			return;

		PhysicsIteration( RenderTarget, Time, this.PositionTexture, this.VelocityTexture, this.ScratchTexture, this.PositionOrigTexture, this.Meta.UpdateVelocityShader, this.Meta.UpdatePositionShader, SetPhysicsUniforms );
	}
	
	this.ResetPhysicsTextures = function()
	{
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float3');
		this.ScratchTexture = new Pop.Image(Size,'Float3');
		this.PositionOrigTexture = new Pop.Image();
		this.PositionOrigTexture.Copy( this.PositionTexture );
	}
	
	this.GetPositionsTexture = function()
	{
		return this.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return this.VelocityTexture;
	}
	
	this.GetPositionOrigTexture = function()
	{
		return this.PositionOrigTexture;
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
			//	gr: making frame duration dynamic now, so time here is always 1
			let Frame = {};
			Frame.GetTime = function()
			{
				return Index / Params.OceanAnimationFrameRate;
			};
			Frame.PositionTexture = new Pop.Image();
			//	gr: load as many as we can (so we can control which ones are availible at the preload time)
			//	todo: change this so it loads async but on demand so doesn't fall over if stuff is missing
			try
			{
				Frame.TriangleBuffer = LoadGeometryFromFile( RenderTarget, Filename, Frame.PositionTexture, Scale );
				this.Frames.push(Frame);
			}
			catch(e)
			{
				Pop.Debug("Ignored frame error",e);
			}
		}
		
		this.Frames = [];
		Filenames.forEach( LoadFrame.bind(this) );
	}
	
	this.GetDuration = function()
	{
		return this.Frames[this.Frames.length-1].GetTime();
	}
	
	this.GetFrame = function(Time)
	{
		//	auto loop
		Time = Time % this.GetDuration();
		
		for ( let i=0;	i<this.Frames.length;	i++ )
		{
			let Frame = this.Frames[i];
			let FrameTime = Frame.GetTime();
			if ( Time <= FrameTime )
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

function ParseColladaSceneAsModel(Filename,OnVertex,OnMeta)
{
	const Contents = Pop.LoadFileAsString( Filename );
	let OnActor = function(Actor)
	{
		OnVertex( ...Actor.Position );
	}
	let OnSpline = function()
	{
	}
	Pop.Collada.Parse( Contents, OnActor, OnSpline );
}


//	seperate func so it can be profiled
function LoadAssetJson(Filename)
{
	const Contents = Pop.LoadFileAsString( Filename );
	const Asset = JSON.parse( Contents );
	return Asset;
}

//	returns a "mesh asset"
function ParseGeometryFromFile(Filename,VertexSkip)
{
	//	auto load cached version
	if ( Pop.FileExists( Filename + MeshAssetFileExtension ) )
	{
		Pop.Debug("Found cached version of " + Filename);
		Filename += MeshAssetFileExtension;
	}
	
	if ( Filename.endsWith(MeshAssetFileExtension) )
	{
		return LoadAssetJson( Filename );
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
		Pop.ParsePlyFile( Filename, OnVertex, OnMeta );
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile( Filename, OnVertex, OnMeta );
	else if ( Filename.endsWith('.random') )
		GenerateRandomVertexes( OnVertex );
	else if ( Filename.endsWith('.dae.json') )
		ParseColladaSceneAsModel( Filename, OnVertex, OnMeta );
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
	
	//	get bounds
	if ( WorldPositions )
	{
		/*
		 let Min = WorldPositions[0];
		 let Max = WorldPositions[0];
		 let Update = function(xyz)
		 {
		 Min = Math.Min3( Min, xyz );
		 Max = Math.Max3( Max, xyz );
		 }
		 WorldPositions.forEach( Update );
		 Pop.Debug( Filename + " bounds == ", Min, Max );
		 */
	}
	
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
		
		let Unrolled = new Float32Array( 3 * WorldPositions.length );
		let PushUnrolled = function(xyz,i)
		{
			Unrolled[(i*3)+0] = xyz[0];
			Unrolled[(i*3)+1] = xyz[1];
			Unrolled[(i*3)+2] = xyz[2];
		}
		WorldPositions.forEach(PushUnrolled);
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
		//Pop.Debug("Auto generating vertex buffer ", GeometryAsset.VertexBuffer);
		if ( GeometryAsset.VertexSize != 2 )
			throw "Expected vertex size of 2 (not " + GeometryAsset.VertexSize + ") for " + GeometryAsset.VertexBuffer;
		
		//	need to work out triangle count...
		const TriangleCount = GeometryAsset.WorldPositions.length;
	
		GeometryAsset.VertexBuffer = GetAuto_AutoVtBuffer(TriangleCount);
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


function PhysicsIteration(RenderTarget,Time,PositionTexture,VelocityTexture,ScratchTexture,PositionOrigTexture,UpdateVelocityShader,UpdatePositionShader,SetPhysicsUniforms)
{
	if ( !Params.EnablePhysicsIteration )
		return;
	
	SetPhysicsUniforms = SetPhysicsUniforms || function(){};
	
	let CopyShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	UpdateVelocityShader = Pop.GetShader( RenderTarget, UpdateVelocityShader, QuadVertShader );
	UpdatePositionShader = Pop.GetShader( RenderTarget, UpdatePositionShader, QuadVertShader );
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
			Shader.SetUniform('OrigPositions',PositionOrigTexture);
			Shader.SetUniform('LastPositions', PositionTexture );
			SetPhysicsUniforms( Shader );
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
			SetPhysicsUniforms( Shader );
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdatePositions );
	
}


