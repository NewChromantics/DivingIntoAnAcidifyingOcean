Pop.Include('AssetImport.js');
Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopTexture.js');

const MeshAssetFileExtension = '.mesh.json';

const RandomTexture = Pop.CreateRandomImage( 1024, 1024 );

const DataTextureWidth = 128;

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

function LoadPointMeshFromFile(RenderTarget,Filename,GetIndexMap,ScaleToBounds)
{
	const CachedFilename = GetCachedFilename(Filename,'geometry');
	if ( Pop.FileExists(CachedFilename) )
		Filename = CachedFilename;
	
	//	load positions, colours
	const Geo = LoadGeometryFile( Filename );
	
	//	mesh stuff
	let PositionSize = Geo.PositionSize;
	let Positions = Geo.Positions;
	let Colours = Geo.Colours;
	let ColourSize = Colours ? 3 : null;
	let Alphas = Geo.Alphas;
	let AlphaSize = Alphas ? 1 : null;

	//	vertex stuff
	//	we should get these from geo for assets WITH a vertex buffer
	let VertexBuffer = 'auto_vt';
	let VertexSize = 2;
	let VertexAttributeName = 'Vertex';
	let TriangleIndexes = 'auto';
	
	//	scale positions
	if ( ScaleToBounds && Positions )
	{
		Pop.Debug("Scaling to ",ScaleToBounds);
		const PositionCount = Positions.length / PositionSize;
		for ( let p=0;	p<PositionCount;	p++ )
		{
			for ( let v=0;	v<PositionSize;	v++ )
			{
				let i = (p * PositionSize)+v;
				let f = Positions[i];
				f = Math.lerp( ScaleToBounds.Min[v], ScaleToBounds.Max[v], f );
				Positions[i] = f;
			}
		}
		
		//	scale up the geo bounding box
		Geo.BoundingBox.Min = Geo.BoundingBox.Min.slice();
		Geo.BoundingBox.Max = Geo.BoundingBox.Max.slice();
		for ( let i=0;	i<3;	i++ )
		{
			Geo.BoundingBox.Min[i] = Math.lerp( ScaleToBounds.Min[i], ScaleToBounds.Max[i], Geo.BoundingBox.Min[i] );
			Geo.BoundingBox.Max[i] = Math.lerp( ScaleToBounds.Min[i], ScaleToBounds.Max[i], Geo.BoundingBox.Max[i] );
		}
	}
	
	const AlphaIsPositionW = true;
	if ( AlphaIsPositionW && Alphas && PositionSize < 4 )
	{
		Pop.Debug(Filename,"Pushing position W as alpha");
		let NewPositions = [];
		for ( let i=0;	i<Positions.length/PositionSize;	i++ )
		{
			let p = i * PositionSize;
			for ( let c=0;	c<PositionSize;	c++ )
			{
				let x = Positions[p+c];
				NewPositions.push(x);
			}
			let a = Alphas[i];
			NewPositions.push(a);
		}
		
		//	positions now 4!
		Positions = NewPositions;
		PositionSize++;
		Alphas = null;
		AlphaSize = null;
	}
	
	//	sort, but consistently
	//	we used to sort for depth, but dont need to any more
	if ( GetIndexMap )
	{
		/*
		let Map = GetIndexMap(Positions);
		let NewPositions = [];
		Map.forEach( i => NewPositions.push(Positions[i]) );
		Positions = NewPositions;
		*/
	}
	
	let PositionImage = new Pop.Image();
	if ( PositionImage )
	{
		//	pad to square
		const Channels = PositionSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Positions.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Position texture",Width,Height,Channels,"Total",PixelDataSize);
		
		const PixelValues = Positions.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;
		
		const PixelFormat = 'Float'+Channels;
		PositionImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}
	
	let ColourImage = null;
	if ( Colours )
	{
		ColourImage = new Pop.Image();
		
		if ( Colours.length != Positions.length )
			throw "Expecting Colours.length ("+Colours.length+") to match Positions.length ("+Positions.length+")";
		//	pad to square
		const Channels = ColourSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Colours.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Colours texture",Width,Height,Channels,"Total",PixelDataSize);

		const PixelValues = Colours.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;

		const PixelFormat = 'Float'+Channels;
		ColourImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}
	
	let AlphaImage = null;
	if ( Alphas )
	{
		AlphaImage = new Pop.Image();
		
		if ( Alphas.length/AlphaSize != Positions.length/PositionSize )
			throw "Expecting Alphas.length ("+Alphas.length+") to match Positions.length ("+Positions.length+")";
		//	pad to square
		const Channels = AlphaSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Alphas.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Alphas texture",Width,Height,Channels,"Total",PixelDataSize);

		const PixelValues = Alphas.slice();
		PixelValues.length = PixelDataSize;
		
		const Pixels = new Float32Array( PixelValues );
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;

		const PixelFormat = 'Float'+Channels;
		AlphaImage.WritePixels( Width, Height, Pixels, PixelFormat );
	}

	//	auto generated vertexes
	if ( VertexBuffer == 'auto_vt' )
	{
		//Pop.Debug("Auto generating vertex buffer ", GeometryAsset.VertexBuffer);
		if ( VertexSize != 2 )
			throw "Expected vertex size of 2 (not " + VertexSize + ") for " + VertexBuffer;
		
		//	need to work out triangle count...
		const TriangleCount = Positions.length;
		VertexBuffer = GetAuto_AutoVtBuffer(TriangleCount);
	}
	
	//	auto generated triangles
	if ( TriangleIndexes == 'auto' )
	{
		const TriangleCount = VertexBuffer.length / VertexSize;
		TriangleIndexes = GetAutoTriangleIndexes( TriangleCount );
	}
	
	//	loads much faster as a typed array
	VertexBuffer = new Float32Array( VertexBuffer );
	TriangleIndexes = new Int32Array( TriangleIndexes );
	
	//let CreateBufferTime = Pop.GetTimeNowMs();
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexBuffer, VertexSize, TriangleIndexes );
	//Pop.Debug("Making triangle buffer took", Pop.GetTimeNowMs()-CreateBufferTime);
	
	TriangleBuffer.BoundingBox = Geo.BoundingBox;
	TriangleBuffer.PositionTexture = PositionImage;
	TriangleBuffer.ColourTexture = ColourImage;
	TriangleBuffer.AlphaTexture = AlphaImage;

	return TriangleBuffer;
}



