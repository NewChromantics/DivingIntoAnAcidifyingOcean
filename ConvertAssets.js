Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('Timeline.js');

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

function ConvertSceneFile(Filename)
{
	const CachedFilename = Filename.replace('.dae.json','.scene.json');
	if ( Pop.FileExists(CachedFilename) )
	{
		//return;
	}
	const Scene = LoadSceneFile( Filename );
	const SceneJson = JSON.stringify(Scene,null,'\t');
	Pop.WriteStringToFile( CachedFilename, SceneJson );
	Pop.ShowFileInFinder( CachedFilename );
}


//	convert some assets
const SceneFiles = ['CameraSpline.dae.json'];
SceneFiles.forEach( ConvertSceneFile );


