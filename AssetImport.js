Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopSvg.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('Timeline.js');

const DataTextureWidth = 128;


function GetCachedFilename(Filename,Type)
{
	if ( !Filename )
		return Filename;
	if ( !Type )
		throw "GetCachedFilename("+Filename+") with no type (" + Type + ")";
	
	let TypeExtension = '.' + Type + '.json';
	//	assume it already has this extension
	if ( Type.includes('.') )
		TypeExtension = '.' + Type;
	
	let CachedFilename = Filename;
	CachedFilename = CachedFilename.replace('.dae.json',TypeExtension);
	CachedFilename = CachedFilename.replace('.svg.json',TypeExtension);
	CachedFilename = CachedFilename.replace('.ply',TypeExtension);
	CachedFilename = CachedFilename.replace('.obj',TypeExtension);
	return CachedFilename;
}


function GenerateRandomVertexes(Contents,OnVertex,OnMeta)
{
	for ( let i=0;	i<2000;	i++ )
	{
		let x = Math.random();
		let y = Math.random();
		let z = Math.random();
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


function ParseColladaSceneAsModel(Contents,OnVertex,OnMeta)
{
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



function SplineToKeyframes(Positions,CameraPositionUniform)
{
	//	make a new timeline
	const Keyframes = [];
	
	const Times = Object.keys(Positions);
	const PushKeyframe = function(Time)
	{
		const Uniforms = {};
		Uniforms[CameraPositionUniform] = Positions[Time];
		const Keyframe = new TKeyframe( Time, Uniforms );
		Keyframes.push( Keyframe );
	}
	Times.forEach( PushKeyframe );
	
	return Keyframes;
}

function LoadSceneFile(Filename)
{
	const Contents = Pop.LoadFileAsString(Filename);

	if ( Filename.endsWith('.scene.json') )
	{
		const Scene = JSON.parse(Contents);
		return Scene;
	}

	const Scene = {};
	Scene.Actors = [];
	Scene.Keyframes = null;
	
	
	const OnActor = function(Actor)
	{
		Scene.Actors.push( Actor );
	}
	
	const OnSpline = function(Spline)
	{
		//	need to do merging
		if ( Scene.Keyframes != null )
			throw "Scene already has keyframes, handle multiple";
		Scene.Keyframes = SplineToKeyframes( Spline.PathPositions, 'CameraPosition' );
	}
	
	if ( Filename.endsWith('.dae.json') )
		Pop.Collada.Parse( Contents, OnActor, OnSpline );
	else
		throw "Unhandled scene file type " + Filename;
	
	return Scene;
}



function ParseGeometryFile(Contents,ParseFunc)
{
	const Positions = [];
	const Colours = [];
	const Alphas = [];
	const PositionSize = 3;
	const Min = [undefined,undefined,undefined];
	const Max = [undefined,undefined,undefined];

	let Update3 = function(Three,Func,Value3)
	{
		Three[0] = Func( Three[0]||Value3[0], Value3[0] );
		Three[1] = Func( Three[1]||Value3[1], Value3[1] );
		Three[2] = Func( Three[2]||Value3[2], Value3[2] );
	}
	
	const OnVertex = function(x,y,z,d,r,g,b)
	{
		let xyz = [x,y,z];
		Update3( Min, Math.min, xyz );
		Update3( Max, Math.max, xyz );

		Positions.push(...xyz);
		if ( d !== undefined )
			Alphas.push( d );
		
		//	todo: catch float vs 8bit by evaluating max
		//	require all 3
		let rgb = [r,g,b];
		if ( !rgb.some( c => (c===undefined) ) )
			Colours.push( ...rgb );
	}
	
	const OnMeta = function()
	{
	}
	
	ParseFunc( Contents, OnVertex, OnMeta );

	const Geo = {};
	Geo.BoundingBox = {};
	Geo.BoundingBox.Min = Min;
	Geo.BoundingBox.Max = Max;
	Geo.Positions = Positions;
	Geo.PositionSize = PositionSize;
	if ( Colours.length )
		Geo.Colours = Colours;
	if ( Alphas.length )
		Geo.Alphas = Alphas;
	
	return Geo;
}

function ParseGeometryJsonFile(Filename)
{
	const Json = Pop.LoadFileAsString(Filename);
	const Geo = JSON.parse(Json);
	return Geo;
}

function LoadGeometryFile(Filename)
{
	Pop.Debug("LoadGeometryFile("+Filename+")");
	
	let Geo = null;
	if ( Filename.endsWith('.geometry.json') )
	{
		Geo = ParseGeometryJsonFile( Filename );
		return Geo;
	}
	
	if ( Filename.endsWith('.random') )
	{
		Geo = ParseGeometryFile( null, GenerateRandomVertexes );
		return Geo;
	}
	
	const Contents = Pop.LoadFileAsString(Filename);
	const FilenameLower = Filename.toLowerCase();
	if ( FilenameLower.endsWith('.ply') )
	{
		Geo = ParseGeometryFile( Contents, Pop.Ply.Parse );
	}
	else if ( FilenameLower.endsWith('.obj') )
	{
		Geo = ParseGeometryFile( Contents, Pop.Obj.Parse );
	}
	else if ( FilenameLower.endsWith('.dae.json') )
	{
		Geo = ParseGeometryFile( Contents, ParseColladaSceneAsModel );
	}
	else if ( FilenameLower.endsWith('.svg.json') )
	{
		Geo = ParseGeometryFile( Contents, Pop.Svg.Parse );
	}
	else
		throw "Don't know how to load " + Filename;
	
	
	return Geo;
}


function LoadGeometryToTextureBuffers(Geo,MaxPositions)
{
	const ScaleToBounds = undefined;
	const GetIndexMap = undefined;
	
	//	mesh stuff
	let PositionSize = Geo.PositionSize;
	let Positions = Geo.Positions;
	let Colours = Geo.Colours;
	let ColourSize = Colours ? 3 : null;
	let Alphas = Geo.Alphas;
	let AlphaSize = Alphas ? 1 : null;
	
	MaxPositions = MaxPositions || Positions.length;
	Positions.length = Math.min( MaxPositions*PositionSize, Positions.length );
	if ( Colours )
		Colours.length = Math.min( MaxPositions*ColourSize, Colours.length );
	if ( Alphas )
		Alphas.length = Math.min( MaxPositions*AlphaSize, Alphas.length );
	
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
	
	const ColoursAs8Bit = true;
	let ColourImage = null;
	if ( Colours )
	{
		ColourImage = new Pop.Image();
		
		if ( Colours.length / ColourSize != Positions.length / PositionSize )
			throw "Expecting Colours.length ("+Colours.length+") to match Positions.length ("+Positions.length+")";
		//	pad to square
		const Channels = ColourSize;
		const Width = DataTextureWidth;
		const Height = Math.GetNextPowerOf2( Colours.length / Width / Channels );
		const PixelDataSize = Channels * Width * Height;
		Pop.Debug("Colours texture",Width,Height,Channels,"Total",PixelDataSize);
		
		const PixelValues = Colours.slice();
		PixelValues.length = PixelDataSize;
		
		let Pixels,PixelFormat;
		if ( ColoursAs8Bit )
		{
			Pixels = new Uint8Array( PixelValues );
			PixelFormat = Channels == 3 ? 'RGB' : 'RGBA';
		}
		else
		{
			Pixels = new Float32Array( PixelValues );
			PixelFormat = 'Float'+Channels;
		}
		if ( Pixels.length != PixelDataSize )
			throw "Float32Array size("+Pixels.length+") didn't pad to " + PixelDataSize;
		
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
	
	const Buffers = {};
	Buffers.BoundingBox = Geo.BoundingBox;
	Buffers.PositionTexture = PositionImage;
	Buffers.ColourTexture = ColourImage;
	Buffers.AlphaTexture = AlphaImage;
	Buffers.TriangleCount = Positions.length;
	
	return Buffers;
}


