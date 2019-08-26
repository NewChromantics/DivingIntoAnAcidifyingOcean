Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('Timeline.js');



function GenerateRandomVertexes(Contents,OnVertex,OnMeta)
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
	
	const Contents = Pop.LoadFileAsString(Filename);
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
		if ( r !== undefined )
			Colours.push(...[r,g,b]);
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

function ParseGeometryJsonFile(Json)
{
	const Geo = JSON.Parse(Json);
	return Geo;
}

function LoadGeometryFile(Filename)
{
	let Geo = null;
	if ( Filename.endsWith('.geometry.json') )
	{
		Geo = ParseGeometryJsonFile( Contents );
		return Geo;
	}
	
	if ( Filename.endsWith('.random') )
	{
		Geo = ParseGeometryFile( null, GenerateRandomVertexes );
		return Geo;
	}
	
	const Contents = Pop.LoadFileAsString(Filename);
	if ( Filename.endsWith('.ply') )
	{
		Geo = ParseGeometryFile( Contents, Pop.Ply.Parse );
	}
	else if ( Filename.endsWith('.obj') )
	{
		Geo = ParseGeometryFile( Contents, Pop.Obj.Parse );
	}
	else if ( Filename.endsWith('.dae.json') )
	{
		Geo = ParseGeometryFile( Contents, ParseColladaSceneAsModel );
	}
	else
		throw "Don't know how to load " + Filename;
	
	
	return Geo;
}

