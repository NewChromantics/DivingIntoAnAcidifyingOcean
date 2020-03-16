Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopCinema4d.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopFrameCounter.js');

//Pop.Include('AssetManager.js');
//Pop.Include('AudioManager.js');
//Pop.Include('ParticleActor.js');
//	already included
//Pop.Include('Timeline.js');
//Pop.Include('Animals.js');

const EnableVoiceOver = Pop.GetExeArguments().includes('EnableVoiceOver');
const AnimalTest = Pop.GetExeArguments().includes('AnimalTest');


//	for debugging opengl stuff
const EnableColourTextureUpdate = true;

//	temp turning off and just having dummy actors
const PhysicsEnabled = !Pop.GetExeArguments().includes('PhysicsDisabled');
var PhsyicsUpdateCount = 0;	//	gotta do one

//	for debugging, keep a copy of the old cameras
const LastXrCameras = {};


const ShowDefaultActors = Pop.GetExeArguments().includes('ShowDefaultActors');
const IgnoreActorPrefixs = ['Camera_Spline'];
//const IgnoreActorPrefixs = ['Camera_Spline',DebrisActorPrefix,NastyAnimalPrefix,BigBangAnimalPrefix,NormalAnimalPrefix];


var DebrisColourTexture = new Pop.Image('DebrisColourTexture');


let DebugCamera = new Pop.Camera();
DebugCamera.Position = [ 0,0,0 ];
DebugCamera.LookAt = [ 0,0,-1 ];
DebugCamera.FarDistance = 400;	//	try not to clip anythig in debug mode

const BigBangExplodeYears = {};
BigBangExplodeYears[1826] = BigBangAnimalPrefix + '0';
BigBangExplodeYears[1828] = BigBangAnimalPrefix + '1';
BigBangExplodeYears[1830] = BigBangAnimalPrefix + '2';
BigBangExplodeYears[1833] = BigBangAnimalPrefix + '3';
BigBangExplodeYears[1836] = BigBangAnimalPrefix + '4';
BigBangExplodeYears[1840] = BigBangAnimalPrefix + '5';
BigBangExplodeYears[1843] = BigBangAnimalPrefix + '6';
BigBangExplodeYears[1846] = BigBangAnimalPrefix + '7';
BigBangExplodeYears[1851] = BigBangAnimalPrefix + '8';
BigBangExplodeYears[1853] = BigBangAnimalPrefix + '9';
BigBangExplodeYears[1855] = BigBangAnimalPrefix + '10';


function IsAutoClearTextureActor(Actor)
{
	if ( Actor.Name.startsWith(OceanActorPrefix) )
	{
		return false;
	}
	
	return true;
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



function GetMusicVolume()	{	return Params.MusicVolume;	}
function GetMusic2Volume()	{	return Params.Music2Volume;	}
function GetVoiceVolume()	{	return Params.VoiceVolume;	}
function GetSoundVolume()	{	return Params.SoundVolume;	}

function GetAudioOverrideState()
{
	const Default = Pop.Audio.DefaultGetGlobalAudioState();
	if (Default)
		return Default;

	if (!Params.ExperiencePlaying)
		return 'Pause';

	return null;
}

var Hud = {};
var AudioManager = new TAudioManager(GetAudioGetCrossFadeDuration,GetMusicVolume,GetMusic2Volume,GetVoiceVolume,GetSoundVolume,GetAudioOverrideState );

var LastMouseClicks = [];	//	array of queued uvs


function IsActorSelectable(Actor)
{
	if ( !Actor.Name )
		return false;
	
	const SelectableNames = AnimalActorPrefixs;
	const Match = SelectableNames.some( MatchName => Actor.Name.startsWith(MatchName) );
	if ( !Match )
		return false;
	
	if ( Actor.AnimalHasBeenExploded )
		return false;
	
	return true;
}


function GetMouseRay(uv)
{
	let ScreenRect = Window.GetScreenRect();
	let Aspect = ScreenRect[2] / ScreenRect[3];
	let x = Math.lerp( -Aspect, Aspect, uv[0] );
	let y = Math.lerp( 1, -1, uv[1] );
	const ViewRect = [-1,-1,1,1];
	let Time = Params.TimelineYear;
	//	get ray
	const Camera = Params.MouseRayOnTimelineCamera ? GetTimelineCamera() : Acid_GetRenderCamera();
	const RayDistance = Params.TestRayDistance;
	
	let ScreenToCameraTransform = Camera.GetProjectionMatrix( ViewRect );
	ScreenToCameraTransform = Math.MatrixInverse4x4( ScreenToCameraTransform );
	
	let StartMatrix = Math.CreateTranslationMatrix( x, y, 0.1 );
	let EndMatrix = Math.CreateTranslationMatrix( x, y, RayDistance );
	StartMatrix = Math.MatrixMultiply4x4( ScreenToCameraTransform, StartMatrix );
	EndMatrix = Math.MatrixMultiply4x4( ScreenToCameraTransform, EndMatrix );
	
	StartMatrix = Math.MatrixMultiply4x4( Camera.GetLocalToWorldMatrix(), StartMatrix );
	EndMatrix = Math.MatrixMultiply4x4( Camera.GetLocalToWorldMatrix(), EndMatrix );

	const Ray = {};
	Ray.Start = Math.GetMatrixTranslation( StartMatrix, true );
	Ray.End = Math.GetMatrixTranslation( EndMatrix, true );
	Ray.Direction = Math.Normalise3( Math.Subtract3( Ray.End, Ray.Start ) );
	
	return Ray;
}


function QueueSceneClick(x,y)
{
	const Rect = Window.GetScreenRect();
	const u = x / Rect[2];
	const v = y / Rect[3];
	LastMouseClicks.push( [u,v] );
}

function UpdateMouseMove(x,y)
{
	const Rect = Window.GetScreenRect();
	const u = x / Rect[2];
	const v = y / Rect[3];
	const CameraScreenUv = [u,v];
	LastMouseRayUv = CameraScreenUv;
	
	//Debug_HighlightActors = GetActorIntersections(CameraScreenUv);
}


function GetActorScene_OnlySelectable()
{
	//const IsActorVisible = GetCameraActorCullingFilter( Camera, Viewport );
	const IsActorVisible = function(Actor)
	{
		if ( Actor.IsVisible === undefined )
			return true;
		return Actor.IsVisible === true;
	}
	const FilterActor = function(Actor)
	{
		if ( !IsActorSelectable(Actor) )
			return false;
		if ( !IsActorVisible(Actor) )
			return false;
		return true;
	}
	
	const Scene = GetActorScene( FilterActor );
	return Scene;
}

function GetActorScene_OnlyVisible()
{
	//const IsActorVisible = GetCameraActorCullingFilter( Camera, Viewport );
	const IsActorVisible = function(Actor)
	{
		if ( Actor.IsVisible === undefined )
			return true;
		return Actor.IsVisible === true;
	}
	
	const Scene = GetActorScene( IsActorVisible );
	return Scene;
}

//	check for animal selection
function CompareNearest(IntersectionA,IntersectionB)
{
	const za = IntersectionA.Position[2];
	const zb = IntersectionB.Position[2];
	if ( za < zb )	return 1;
	if ( za > zb )	return -1;
	return 0;
}

function GetActorIntersections(CameraScreenUv)
{
	const Rect = Window.GetScreenRect();
	
	//Pop.Debug(CameraScreenUv);
	const Time = Params.TimelineYear;
	const Viewport = [0,0,Rect[2],Rect[3]];
	const Camera = GetTimelineCamera();
	
	const Ray = GetMouseRay( CameraScreenUv );

	//	find actor
	const Scene = GetActorScene_OnlySelectable();
	let SelectedActors = GetIntersectingActors( Ray, Scene, Params.MaxHighlightDistance );
	
	if ( SelectedActors.length == 0 )
		return [];
	
	if ( SelectedActors.length > 1 )
	{
		//	sort by nearest!
		SelectedActors.sort( CompareNearest );
	}
	
	//	filter to one
	SelectedActors = [SelectedActors[0]];
	let ActorSelectedActor = SelectedActors[0].Actor;
	
	return SelectedActors;
}


const TimelineMinYear				= 1808;
const TimelineBigBangStartYear		= 1826;
const TimelineBigBangEndYear		= 1857;
const TimelineMinInteractiveYear	= 1859;
const TimelineSkipIntroToYear		= 1860;
const Timeline_Text1_Year			= 1881;
const Timeline_Text2_Year			= 1910;
const Timeline_Text3_Year			= 2020;
const TimelineMaxInteractiveYear	= 2100;
const TimelineGalleryStartYear		= 2133;
const TimelineGalleryEndYear		= 2143;
const TimelineSolutionYear			= 2145;
const TimelineMaxYear				= 2160;

const Timeline_AllowIntroSkipAfterYear = 1812;
const TimelineRewindToYear = 1808;

Params.TimelineYear = TimelineMinYear;
Params.RewindYearsPerSecond = 35;
Params.CustomYearsPerSecond = false;
Params.ShowAnimal_ExplodeSecs = 0;
Params.ShowAnimal_Duration = 600;
Params.ShowAnimal_CameraOffsetX = 0.48;
Params.ShowAnimal_CameraOffsetY = 0.02;
Params.ShowAnimal_CameraOffsetZ = 1.34;
Params.ShowAnimal_CameraLerpInSpeed = 0.275;
Params.ShowAnimal_CameraLerpOutSpeed = 0.10;
Params.AnimalBufferLod = 1.0;
Params.DebugCullTimelineCamera = true;
Params.TransposeFrustumPlanes = false;
Params.FrustumCullTestX = false;	//	re-enable when we cull on bounding box
Params.FrustumCullTestY = true;	//	re-enable when we cull on bounding box
Params.FrustumCullTestZ = true;
Params.MouseRayOnTimelineCamera = false;
Params.TestRaySize = 0.39;
Params.DrawTestRay = false;
Params.TestRayDistance = 0.82;
Params.ExperiencePlaying = true;
Params.AutoGrabDebugCamera = false;
Params.UseDebugCamera = false;
Params.EnableMusic = true;
Params.MusicVolume = 1;
Params.Music2Volume = 1;
Params.VoiceVolume = 1;
Params.SoundVolume = 1;
Params.DebugCameraPositionCount = 0;
Params.DebugCameraPositionScale = 0.15;
Params.FogHighlightMinDistance = 0.8;
Params.FogHighlightMaxDistance = 2.7;
Params.FogParamsLerpSpeed = 0.1;
Params.FogTargetLerpSpeed = 0.2;
Params.BillboardTriangles = true;
Params.ShowClippedParticle = false;
Params.CameraNearDistance = 0.1;
Params.CameraFarDistance = Params.FogMaxDistance;
Params.AudioCrossFadeDurationSecs = 2;
Params.MaxSwirlActors = 4;

Params.CustomiseWaterColours = false;
Params.UpdateColourTextureFrequencySecs = 1.5;
Params.Debris_Colour0 = InvalidColour;
Params.Debris_Colour1 = InvalidColour;
Params.Debris_Colour2 = InvalidColour;
Params.Debris_Colour3 = InvalidColour;
Params.Debris_Colour4 = InvalidColour;
Params.Debris_Colour5 = InvalidColour;
Params.Debris_Colour6 = InvalidColour;
Params.Debris_Colour7 = InvalidColour;
Params.Debris_Colour8 = InvalidColour;
Params.Debris_Colour9 = InvalidColour;




let OnParamsChanged = function(Params,ChangedParamName)
{
	if ( ChangedParamName == 'UseDebugCamera' && Params.UseDebugCamera )
		OnSwitchedToDebugCamera();
}

let ParamsWindow = {};
ParamsWindow.OnParamChanged = function(){};

if ( IsDebugEnabled() )
{
	const ParamsWindowRect = [800,20,350,200];
	ParamsWindow = new CreateParamsWindow(Params,OnParamsChanged,ParamsWindowRect);
	ParamsWindow.AddParam('TimelineYear',TimelineMinYear,TimelineMaxYear);	//	can no longer clean as we move timeline in float
	ParamsWindow.AddParam('YearsPerSecond',0,10);
	ParamsWindow.AddParam('CustomYearsPerSecond');
	ParamsWindow.AddParam('ExperiencePlaying');
	ParamsWindow.AddParam('UseDebugCamera');
	ParamsWindow.AddParam('MusicVolume',0,1);
	ParamsWindow.AddParam('Music2Volume',0,1);
	ParamsWindow.AddParam('VoiceVolume',0,1);
	ParamsWindow.AddParam('SoundVolume',0,1);
	ParamsWindow.AddParam('ShowAnimal_ExplodeSecs',0,20);
	ParamsWindow.AddParam('ShowAnimal_Duration',0,60);
	ParamsWindow.AddParam('ShowAnimal_CameraOffsetX',-10,10);
	ParamsWindow.AddParam('ShowAnimal_CameraOffsetY',-10,10);
	ParamsWindow.AddParam('ShowAnimal_CameraOffsetZ',-10,10);
	ParamsWindow.AddParam('ShowAnimal_CameraLerpInSpeed',0,1);
	ParamsWindow.AddParam('ShowAnimal_CameraLerpOutSpeed',0,1);

	ParamsWindow.AddParam('AutoGrabDebugCamera');

	ParamsWindow.AddParam('FogHighlightMinDistance',0,50);
	ParamsWindow.AddParam('FogHighlightMaxDistance',0,50);
	ParamsWindow.AddParam('FogParamsLerpSpeed',0,1);
	ParamsWindow.AddParam('EnableMusic');
	ParamsWindow.AddParam('AudioCrossFadeDurationSecs',0,10);

	ParamsWindow.AddParam('DebugCameraPositionCount',0,200,Math.floor);
	ParamsWindow.AddParam('DebugCameraPositionScale',0,1);

	ParamsWindow.AddParam('DebugCullTimelineCamera');
	ParamsWindow.AddParam('FrustumCullTestX');
	ParamsWindow.AddParam('FrustumCullTestY');
	ParamsWindow.AddParam('FrustumCullTestZ');
	ParamsWindow.AddParam('MouseRayOnTimelineCamera');
	ParamsWindow.AddParam('TestRayDistance',-1,1);
	ParamsWindow.AddParam('TestRaySize',0,10);
	ParamsWindow.AddParam('DrawTestRay');
	ParamsWindow.AddParam('DrawHighlightedActors');
	ParamsWindow.AddParam('MaxHighlightDistance',0,100);
	ParamsWindow.AddParam('EnablePhysicsIteration');
	ParamsWindow.AddParam('BillboardTriangles');
	ParamsWindow.AddParam('ShowClippedParticle');
	ParamsWindow.AddParam('CameraNearDistance', 0.01, 10);
	ParamsWindow.AddParam('CameraFarDistance', 1, 100);
	
	ParamsWindow.AddParam('CustomiseWaterColours');
	ParamsWindow.AddParam('UpdateColourTextureFrequencySecs',0,4);
	
	ParamsWindow.AddParam('Debris_Colour0','Colour');
	ParamsWindow.AddParam('Debris_Colour1','Colour');
	ParamsWindow.AddParam('Debris_Colour2','Colour');
	ParamsWindow.AddParam('Debris_Colour3','Colour');
	ParamsWindow.AddParam('Debris_Colour4','Colour');
	ParamsWindow.AddParam('Debris_Colour5','Colour');
	ParamsWindow.AddParam('Debris_Colour6','Colour');
	ParamsWindow.AddParam('Debris_Colour7','Colour');
	ParamsWindow.AddParam('Debris_Colour8','Colour');
	ParamsWindow.AddParam('Debris_Colour9','Colour');
	ParamsWindow.AddParam('Ocean_Colour0','Colour');
	ParamsWindow.AddParam('Ocean_Colour1','Colour');
	ParamsWindow.AddParam('Ocean_Colour2','Colour');
	ParamsWindow.AddParam('Ocean_Colour3','Colour');
	ParamsWindow.AddParam('Ocean_Colour4','Colour');
	ParamsWindow.AddParam('Ocean_Colour5','Colour');
	ParamsWindow.AddParam('Ocean_Colour6','Colour');
	ParamsWindow.AddParam('Ocean_Colour7','Colour');
	ParamsWindow.AddParam('Ocean_Colour8','Colour');
	ParamsWindow.AddParam('Ocean_Colour9','Colour');
	ParamsWindow.AddParam('Swirl_Colour0','Colour');
	ParamsWindow.AddParam('Swirl_Colour1','Colour');
	ParamsWindow.AddParam('Swirl_Colour2','Colour');
	ParamsWindow.AddParam('Swirl_Colour3','Colour');
	ParamsWindow.AddParam('Swirl_Colour4','Colour');
	ParamsWindow.AddParam('Swirl_Colour5','Colour');
	ParamsWindow.AddParam('Swirl_Colour6','Colour');
	ParamsWindow.AddParam('Swirl_Colour7','Colour');
	ParamsWindow.AddParam('Swirl_Colour8','Colour');
	ParamsWindow.AddParam('Swirl_Colour9','Colour');

	Params.InitParamsWindow( ParamsWindow );
}


function AddSwirlActor()
{
	if ( Acid.SwirlActors.length >= Params.MaxSwirlActors )
		return;
	
	function GetSplineStartPos()
	{
		const Pos = Acid.GetCameraPosition();
		Pos[0] += Params.Swirl_StartPositionX;
		Pos[1] += Params.Swirl_StartPositionY;
		Pos[2] += Params.Swirl_StartPositionZ;
		return Pos;
	}
	
	{
		//	reset previous asset
		//	gr: maybe need a better idea here (like set an incrementing function name, or generate the asset now)
		InvalidateAsset('GenerateRandomSplinePathVertexes()');
		let Actor = new TActor();
		Actor.Name = "Swirl";
		let SplineStartPos = GetSplineStartPos();
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...SplineStartPos );
		
		SetupSwirlTextureBufferActor.call( Actor, GetSwirlMeta().Filename, GetSwirlMeta );
		Acid.SwirlActors.push( Actor );
		//Actor.EnablePhysics();
		//Actor.BoundingBox.Min = [-100,-100,-100];
		//Actor.BoundingBox.Max = [100,100,100];
		Pop.Debug("Created swirl",Actor);
	}
}


function LoadCameraScene(Filename)
{
	Pop.Debug("LoadCameraScene",Filename);
	let Scene = [];
	
	let OnActor = function(ActorNode)
	{
		if ( IgnoreActorPrefixs.some( MatchName => ActorNode.Name.includes(MatchName) ) )
		{
			Pop.Debug("Ignoring actor node " + ActorNode.Name, ActorNode );
			return;
		}

		//	to try and keep everything in sync, grab the same actor from the logo scene
		if (Logo.WaterActor)
		{
			if (Logo.WaterActor.Name == ActorNode.Name)
			{
				Scene.push(Logo.WaterActor);
				return;
			}
		}
		
		//Pop.Debug("Loading actor", ActorNode.Name, ActorNode );
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
		
		//	there are some new objects with no bounding boxes or geo,
		//	but they're not ones we want to turn to animals anyway
		let IsAnimalActor = IsActorSelectable(Actor);
		const IsDebrisActor = ActorNode.Name.startsWith(DebrisActorPrefix);
		const IsOceanActor = ActorNode.Name.startsWith(OceanActorPrefix);
		const IsWaterActor = IsOceanActor || ActorNode.Name.startsWith(WaterActorPrefix);
		const IsSwirlActor = ActorNode.Name.startsWith(SwirlActorPrefix);
		
		if ( ShowDefaultActors )
			IsAnimalActor = false;
		
		const IsParticleActor = IsSwirlActor || IsAnimalActor || IsDebrisActor || IsOceanActor;
		
		//if ( !ShowDefaultActors && IsParticleActor )
		if ( IsParticleActor )
		{
			//let LocalScale = ActorNode.Scale;
			let WorldPos = ActorNode.Position;
			Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...WorldPos );
			Actor.BoundingBox = ActorNode.BoundingBox;
			
			if ( IsSwirlActor )
			{
				SetupSwirlTextureBufferActor.call( Actor, GetSwirlMeta().Filename, GetSwirlMeta );
			}
			else if ( IsWaterActor )
			{
				Pop.Debug("Wateractor",ActorNode);
				SetupAnimalTextureBufferActor.call( Actor, GetWaterMeta().Filename, GetWaterMeta );
			}
			else if ( IsDebrisActor )
			{
				SetupAnimalTextureBufferActor.call( Actor, GetDebrisMeta().Filename, GetDebrisMeta );
			}
			else
			{
				const Animal = GetRandomAnimal( ActorNode.Name );
				Actor.Animal = Animal;
				//	gr: this helped with debugging, but for some things we're looking for actors by name
				//Actor.Name += " " + Animal.Name;
				let GetMeta = GetAnimalMeta;
				if ( ActorNode.Name.startsWith( NastyAnimalPrefix ) )
					GetMeta = GetNastyAnimalMeta;
				if ( ActorNode.Name.startsWith( BigBangAnimalPrefix ) )
					GetMeta = GetBigBangAnimalMeta;
				SetupAnimalTextureBufferActor.call( Actor, Animal.Model, GetMeta );
			}
		}
		else
		{
			Pop.Debug("Making default actor",ActorNode.Name);
			
			let LocalScale = ActorNode.Scale;
			let WorldPos = ActorNode.Position;
			Actor.Geometry = 'Cube';
			
			//	some nodes have no geometry, so no bounding box
			if ( !ActorNode.BoundingBox )
			{
				ActorNode.BoundingBox = {};
				ActorNode.BoundingBox.Min = [0,0,0];
				ActorNode.BoundingBox.Max = [1,1,1];
			}
			
			const RenderAsBounds = true;
			if ( RenderAsBounds )
			{
				//	undo the bounds scale and render the cube at the bounds scale
				//	but that'll scale bounds too, so undo that (just to 0..1)
				let BoundsCenter = Math.Lerp3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min, 0.5 );
				let BoundsScale = Math.Subtract3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min );
				
				BoundsScale = Math.Multiply3( BoundsScale, [0.5,0.5,0.5] );
				
				LocalScale = BoundsScale;
				WorldPos = Math.Add3( WorldPos, BoundsCenter );
				ActorNode.BoundingBox.Max = [1,1,1];
				ActorNode.BoundingBox.Min = [0,0,0];
				Pop.Debug( ActorNode.Name, "BoundsScale", BoundsScale, "ActorNode.Scale", ActorNode.Scale );
			}
			
			let LocalScaleMtx = Math.CreateScaleMatrix( ...LocalScale );
			let WorldPosMtx = Math.CreateTranslationMatrix( ...WorldPos );
			
			Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPosMtx, LocalScaleMtx );
			
			Actor.RenderShader = GeoColourShader;
			Actor.BoundingBox = ActorNode.BoundingBox;
		}
		Scene.push( Actor );
	}
	
	const CachedFilename = GetCachedFilename(Filename,'scene');
	if ( Pop.FileExists(CachedFilename) )
		Filename = CachedFilename;
	const FileScene = LoadSceneFile(Filename);
	
	FileScene.Actors.forEach( OnActor );
	
	const Timeline = new TTimeline( FileScene.Keyframes );
	GetCameraTimelineAndUniform = function()
	{
		return [Timeline,'CameraPosition'];
	}
	
	return Scene;
}


//	default reads from default timeline
let GetCameraTimelineAndUniform = function()
{
	return [Acid.Timeline,'Timeline_CameraPosition'];
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
	//Pop.Debug("GetCameraPath",CameraPositions);
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

function GetTimelineCamera()
{
	let Camera = new Pop.Camera();
	Camera.Position = Acid.GetCameraPosition();
	
	//	camera always faces forward now
	Camera.LookAt = Camera.Position.slice();
	Camera.LookAt[2] -= 1.0;
	
	Camera.NearDistance = Params.CameraNearDistance;
	Camera.FarDistance = Params.CameraFarDistance;
	return Camera;
}

function Acid_GetRenderCamera()
{
	if ( Params.UseDebugCamera )
		return DebugCamera;
	
	return GetTimelineCamera();
}





//	filter for culling
function GetActorScene(Filter)
{
	let Scene = [];
	Filter = Filter || function(Actor)	{	return true;	};

	let PushCameraSceneActor = function(Actor)
	{
		if ( !Filter(Actor) )
			return;
		
		Scene.push(Actor)
	}
	
	Acid.CameraScene.forEach( PushCameraSceneActor );
	Acid.SwirlActors.forEach( PushCameraSceneActor );
	
	return Scene;
}

function UpdateActorScene(TimeStep)
{
	//	update all actors and delete any that return false
	Acid.CameraScene = Acid.CameraScene.filter( a => a.Update(TimeStep) );
	Acid.SwirlActors = Acid.SwirlActors.filter( a => a.Update(TimeStep) );
}


//	get scene graph
function GetRenderScene(GetActorScene,Time)
{
	let Scene = [];
	
	let PushActorBox = function(LocalToWorldTransform,BoundsMin,BoundsMax,Filled=Params.DrawBoundingBoxesFilled)
	{
		//	bounding box to matrix...
		const BoundsSize = Math.Subtract3( BoundsMax, BoundsMin );
		
		//	cube is currently -1..1 so compensate. Need to change shader if we change this
		BoundsSize[0] /= 2;
		BoundsSize[1] /= 2;
		BoundsSize[2] /= 2;
		
		const BoundsCenter = Math.Lerp3( BoundsMin, BoundsMax, 0.5 );
		let BoundsMatrix = Math.CreateTranslationMatrix(...BoundsCenter);
		BoundsMatrix = Math.MatrixMultiply4x4( BoundsMatrix, Math.CreateScaleMatrix(...BoundsSize) );
		BoundsMatrix = Math.MatrixMultiply4x4( LocalToWorldTransform, BoundsMatrix );
		
		const BoundsActor = new TActor();
		const BoundsLocalScale = []
		BoundsActor.LocalToWorldTransform = BoundsMatrix;
		BoundsActor.Geometry = 'Cube';
		BoundsActor.RenderShader = GeoEdgeShader;
		BoundsActor.Uniforms['ChequerFrontAndBack'] = Filled;
		BoundsActor.Uniforms['ChequerSides'] = Filled;
		BoundsActor.Uniforms['LineWidth'] = 0.05;
		
		Scene.push( BoundsActor );
	}
	
	let PushActorBoundingBox = function(Actor,ForceDraw)
	{
		if ( !ForceDraw )
			if ( !Params.DrawBoundingBoxes && !Params.DrawBoundingBoxesFilled )
				return;
		
		//	has no bounds!
		const LocalBoundingBox = Actor.GetBoundingBox();
		if ( !LocalBoundingBox )
		{
			Pop.Debug("Actor has no bounds",Actor);
			return;
		}
		
		//PushActorBox( Actor.GetLocalToWorldTransform(), LocalBoundingBox.Min, LocalBoundingBox.Max );

		//	test world bounding box calculation
		const CullBoundingBox = GetActorWorldCullingBoundingBox(Actor);
		PushActorBox( Math.CreateIdentityMatrix(), CullBoundingBox.Min, CullBoundingBox.Max );

		const SelectBoundingBox = GetActorWorldSelectionBoundingBox(Actor);
		PushActorBox( Math.CreateIdentityMatrix(), SelectBoundingBox.Min, SelectBoundingBox.Max );
	}
	
	let PushDebugCameraActor = function(Camera)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Camera.GetLocalToWorldFrustumTransformMatrix();
		Actor.Geometry = 'Cube';
		Actor.RenderShader = GeoEdgeShader;
		Actor.Uniforms['ChequerFrontAndBack'] = true;
		Actor.Uniforms['ChequerSides'] = false;
		Actor.Uniforms['LineWidth'] = 0.01;
		
		Scene.push( Actor );
	}
	
	let PushCameraPosActor = function(Position)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...Position);
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( Actor.LocalToWorldTransform, Math.CreateScaleMatrix(LocalScale) );
		Actor.Geometry = 'Cube';
		Actor.RenderShader = GeoColourShader;
		Scene.push( Actor );
	}
	
	const ActorScene = GetActorScene();
	ActorScene.forEach( a => PushActorBoundingBox(a) );
	ActorScene.forEach( a => Scene.push(a) );
	
	const CameraPositions = GetCameraPath();
	CameraPositions.forEach( PushCameraPosActor );
	
	if ( Params.UseDebugCamera )
	{
		let TimelineCamera = GetTimelineCamera();
		PushDebugCameraActor(TimelineCamera);

		Object.keys( LastXrCameras ).forEach( Name => PushDebugCameraActor(LastXrCameras[Name]) );
	}
	
	if ( LastMouseRayUv && Params.DrawTestRay )
	{
		const Ray = GetMouseRay( LastMouseRayUv );
		let RayEnd = Math.CreateTranslationMatrix( ...Ray.End );
		let TestSize = Params.TestRaySize / 2;
		let Min = [-TestSize,-TestSize,-TestSize];
		let Max = [TestSize,TestSize,TestSize];
		PushActorBox( RayEnd, Min, Max, true );
	}
	
	//	draw intersections
	let DrawIntersection = function(Intersection)
	{
		PushActorBoundingBox( Intersection.Actor, true );
		//Pop.Debug("Selected",Intersection.Actor.Name);
		let Pos = Math.CreateTranslationMatrix( ...Intersection.Position );
		let TestSize = Params.TestRaySize / 2;
		let Min = [-TestSize,-TestSize,-TestSize];
		let Max = [TestSize,TestSize,TestSize];
		PushActorBox( Pos, Min, Max, true );
	}
	
	if ( Params.DrawHighlightedActors )
	{
		if ( LastMouseRayUv )
		{
			const Intersections = GetActorIntersections(LastMouseRayUv);
			Intersections.forEach( DrawIntersection );
		}
	}
	
	return Scene;
}


function Acid_GetRenderScene()
{
	//Pop.Debug('Acid_GetRenderScene');
	//	grab scene first, we're only going to update physics on visible items
	//	todo: just do them all?
	const Time = Params.TimelineYear;

	const Scene = GetRenderScene(GetActorScene_OnlyVisible,Time);
	return Scene;
}

function ShowElement(ElementId,Visible=true)
{
	const Element = document.getElementById(ElementId);
	Element.style.visibility = Visible ? 'visible' : 'hidden';
}

function GetAudioGetCrossFadeDuration()
{
	return Params.AudioCrossFadeDurationSecs;
}

function OnPauseToggle(PauseButton)
{
	//	toggle playing
	Params.ExperiencePlaying = !Params.ExperiencePlaying;
	
	//	update label
	ShowElement('PauseLabel',Params.ExperiencePlaying);
	ShowElement('ResumeLabel',!Params.ExperiencePlaying);
}


//	need a better place for this, app state!
function Init()
{
	Acid.CameraScene = LoadCameraScene('CameraSpline.dae.json');
	Acid.Timeline = LoadTimeline('Timeline.json');
	Acid.TextTimeline1 = LoadTimeline('TextTimeline1.json');
	Acid.TextTimeline2 = LoadTimeline('TextTimeline2.json');
	Acid.TextTimeline3 = LoadTimeline('TextTimeline3.json');

	//	init very first camera pos
	Acid.CameraPosition = GetTimelineCameraPosition( Params.TimelineYear );

	Hud.PauseButton = new Pop.Hud.Button('PauseButton');
	Hud.PauseButton.SetVisible(true);
	Hud.PauseButton.OnClicked = function(){	OnPauseToggle(Hud.PauseButton);	};

	Hud.MusicLabel = new Pop.Hud.Label('AudioMusicLabel');
	Hud.Music2Label = new Pop.Hud.Label('AudioMusic2Label');
	Hud.VoiceLabel = new Pop.Hud.Label('AudioVoiceLabel');
	Hud.SubtitleLabel = new Pop.Hud.Label('SubtitleLabel');
	Hud.SubtitleSkipButton = new Pop.Hud.Button('SkipButton');
	Hud.SubtitleSkipButton.SetVisible(false);
	Hud.IntroSkipButton = new Pop.Hud.Button('JumpButtonIntro');
	Hud.IntroSkipButton.SetVisible(false);
	Hud.RestartButton = new Pop.Hud.Button('JumpButtonConclusion');
	Hud.RestartButton.SetVisible(false);
	Hud.RestartButton.OnClicked = function ()
	{
		Acid.UserRestarted = true;
	}

	Hud.Timeline = new Pop.Hud.Label('TimelineContainer');
	Hud.YearLabel = new Pop.Hud.Label('YearLabel');
	Hud.YearSlider = new Pop.Hud.Slider('YearSlider');
	Hud.YearSlider.SetMinMax( TimelineMinInteractiveYear, TimelineMaxInteractiveYear );
	Hud.YearSlider.OnChanged = function(NewValue)
	{
		Pop.Debug("Slider changed",NewValue);
		Acid.UserSetYear = NewValue;
		
		//	don't hide the hint any more after dragging.
		//Acid.EnableDragHint = false;
	}
	
	Hud.Stats = new Pop.Hud.Label('Stats');
	Hud.Stats_Temp = new Pop.Hud.Label('Stats_Temp_Label');
	Hud.Stats_Co2 = new Pop.Hud.Label('Stats_Co2_Label');
	Hud.Stats_Oxygen = new Pop.Hud.Label('Stats_Oxygen_Label');
	Hud.Stats_Ph = new Pop.Hud.Label('Stats_Ph_Label');

	Hud.Mosaic = new Pop.Hud.Label('Mosaic');
	Hud.Solution = new Pop.Hud.Label('Solution');

	Hud.Animal_Card = new Pop.Hud.Label('AnimalCard');
	Hud.Animal_Title = new Pop.Hud.Label('AnimalCard_Title');
	Hud.Animal_Description = new Pop.Hud.Label('AnimalCard_Description');
	Hud.Animal_ContinueButton = new Pop.Hud.Button('Continue');

	InitDebugHud(Hud);

	Hud.Animal_Card.SetVisible(false);
	
	Hud.Hint_ClickAnimal = new Pop.Hud.Label('Hint_ClickAnimal');
	Hud.Hint_DragTimeline = new Pop.Hud.Label('Hint_DragTimeline');

	Hud.SetShareText = function(Text)
	{
		//	hacky web thing
		if (!document)
			return;
		function SetShareText(ElementName)
		{
			const Element = document.getElementById(ElementName);
			if (!Element)
				return;
			Element.ShareText = Text;
		}
		const Elements = ['AnimalCardShare_0','AnimalCardShare_1','AnimalCardShare_2','AnimalCardShare_3'];
		Elements.forEach(SetShareText);
	}

	
	//	setup window (we do it here so we know update has happened first)
	//Window.OnRender = AcidScene_Render;

	Window.OnMouseUp = function () { };

	Window.OnMouseDown = function(x,y,Button)
	{
		if ( Button == 0 )
		{
			QueueSceneClick( x, y );
		}
		
		Window.OnMouseMove( x, y, Button, true );
	}
	
	Window.OnMouseMove = function(x,y,Button,FirstClick=false)
	{
		UpdateMouseMove( x, y );
		
		if ( Button == 0 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			SwitchToDebugCamera();
			DebugCamera.OnCameraPanLocal( x, 0, -y, FirstClick );
		}
		if ( Button == 2 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			SwitchToDebugCamera(true);
			DebugCamera.OnCameraPanLocal( x, y, 0, FirstClick );
		}
		if ( Button == 1 )
		{
			SwitchToDebugCamera(true);
			DebugCamera.OnCameraOrbit( x, y, 0, FirstClick );
		}
	}
	
	Window.OnMouseScroll = function(x,y,Button,Delta)
	{
		let Fly = Delta[1] * 10;
		Fly *= Params.ScrollFlySpeed;
		
		SwitchToDebugCamera(true);
		DebugCamera.OnCameraPanLocal( 0, 0, 0, true );
		DebugCamera.OnCameraPanLocal( 0, 0, Fly, false );
	}
	
	async function XrLoop()
	{
		const Device = await Pop.Xr.CreateDevice( Window );
		
		//	re-use render func
		Device.OnRender = Render;
		
		//	stay in loop here before exiting
		//	request controller poses, this should error if there's a problem and we'll revert to non xr mode
		while ( true )
		{
			await Pop.Yield(100000);
		}
	}
	
	function OnExitXr(Error)
	{
		console.error("XR exited; ",Error);
		//	todo: handle this error/exit and put back a button to
		//	allow player to try and enter again
		Params.XrMode = false;
	}
	
	//	init XR mode
	if ( Params.XrMode )
	{
		XrLoop().then( OnExitXr ).catch( OnExitXr );
	}

	
	//	show hud
	let Div = new Pop.Hud.Label('Experience');
	Div.SetVisible(true);
}

var Acid = {};

//	use a string if function not yet declared
Acid.State_Init = 'Init';
Acid.State_Intro = 'Intro';
Acid.State_Fly = 'Fly';
Acid.State_TextTimeline1 = 'TextTimeline1';
Acid.State_TextTimeline2 = 'TextTimeline2';
Acid.State_TextTimeline3 = 'TextTimeline3';
Acid.State_ShowAnimal = 'ShowAnimal';
Acid.State_BigBang = 'BigBang';
Acid.State_Outro = 'Outro';
Acid.State_Gallery = 'Gallery';
Acid.State_Solution = 'Solution';
Acid.State_RewindToStart = 'RewindToStart';
Acid.StateMap =
{
	'Init':		Update_Init,
	'Intro':		Update_Intro,
	'BigBang':		Update_BigBang,
	'Fly':			Update_Fly,
	'TextTimeline1':	Update_TextTimeline1,
	'TextTimeline2':	Update_TextTimeline2,
	'TextTimeline3':	Update_TextTimeline3,
	'ShowAnimal':		Update_ShowAnimal,
	'Outro':			Update_Outro,
	'Gallery':			Update_Gallery,
	'Solution':			Update_Solution,
	'RewindToStart':	Update_RewindToStart
};
Acid.StateMachine = new Pop.StateMachine(Acid.StateMap,Acid.State_Init,Acid.State_Init, true );
Acid.SelectedActor = null;
Acid.SkipSelectedAnimal = false;
Acid.UserSetYear = null;
Acid.CameraPosition = null;	//	current pos for lerping depending on state
Acid.GetCameraPosition = function()
{
	if ( !Acid.CameraPosition )
		throw "this should have been set before use";
	return Acid.CameraPosition.slice();
}
Acid.GetFogParams = function()
{
	const FogParams = {};
	const CameraPos = Acid.GetCameraPosition();

	FogParams.WorldPosition = CameraPos;
	FogParams.MinDistance = Params.FogMinDistance;
	FogParams.MaxDistance = Params.FogMaxDistance;
	return FogParams;
}

Acid.CameraScene = null;
Acid.SwirlActors = [];
Acid.Timeline = null;
Acid.TextTimeline1 = null;
Acid.TextTimeline2 = null;
Acid.TextTimeline3 = null;
/* disable hints by making these !true */
Acid.EnableClickHint = true;
Acid.EnableDragHint = true;
Acid.UserSkippedIntro = false;
Acid.UserSkippedText = false;	//	any sub-text in a section
Acid.UserRestarted = false;
Acid.TextTimelineSubTime = null;


function UpdateFog(FrameDuration)
{
	if ( Acid.SelectedActor )
	{
		//	update position in case user quickly switches
		let ActorPos = GetActorWorldPos( Acid.SelectedActor );
	}
}

function Update_ShowAnimal(FirstUpdate,FrameDuration,StateTime)
{
	UpdateFog(FrameDuration);
	
	if ( FirstUpdate )
	{
		Pop.Debug("Update_ShowAnimal firstupdate");
		Acid.EnableClickHint = false;
		Acid.RestoreDragHint = Acid.EnableDragHint;
		Acid.EnableDragHint = false;

		//	update hud to the current animal
		//	move/offset camera to focus on it
		const Animal = Acid.SelectedActor.Animal;
		if ( !Animal )
			throw "No selected animal";

		//	no longer selectable
		Acid.SelectedActor.AnimalHasBeenExploded = true;
		
		Hud.Animal_Card.SetVisible(true);
		Hud.Animal_Title.SetValue( Animal.Name );
		Hud.Animal_Description.SetValue( Animal.Description );
		Hud.SetShareText(Animal.ShareText);

		Acid.SkipSelectedAnimal = false;
		Hud.Animal_ContinueButton.OnClicked = function()
		{
			if ( AnimalTest )
			{
				Acid.SelectedActor.ResetPhysicsTextures();
			}
			Acid.SkipSelectedAnimal = true;
		}
		
		//	play a nosie!
		AudioManager.PlaySound( AnimalSelectedSoundFilename );
	}
	
	Acid_Update( FrameDuration );

	//	no timeline!
	Hud.Timeline.SetVisible(false);
	
	const AnimalBounds = GetActorWorldSelectionBoundingBox(Acid.SelectedActor);
	
	//	target the near side of the bounds (this helps for meshes which are offset, as well as size)
	const TargetCameraPos = Math.Lerp3( AnimalBounds.Min, AnimalBounds.Max, 0.5 );
	TargetCameraPos[2] = AnimalBounds.Max[2];
	
	const Offset = Acid.SelectedActor.GetMeta().ShowAnimal_CameraOffset;
	TargetCameraPos[0] += Offset[0];
	TargetCameraPos[1] += Offset[1];
	TargetCameraPos[2] += Offset[2];
	
	//	lerp camera
	Acid.CameraPosition = Math.Lerp3( Acid.CameraPosition, TargetCameraPos, Params.ShowAnimal_CameraLerpInSpeed );
	
	
	
	//	never exit
	if ( AnimalTest )
		return;
	
	let Finished = false;
	if ( StateTime > Params.ShowAnimal_Duration )
		Finished = true;

	if ( Acid.SkipSelectedAnimal )
		Finished = true;
	
	//	if we exit early, trigger explode
	if ( Finished || StateTime > Params.ShowAnimal_ExplodeSecs )
	{
		if ( !Acid.SelectedActor.UpdatePhysics )
		{
			Pop.Debug("Explode animal");
			Acid.SelectedActor.EnablePhysics();
			
			let Meta = Acid.SelectedActor.GetMeta ? Acid.SelectedActor.GetMeta() : null;
			if ( Meta && Meta.PhysicsAudioFilename )
			{
				const NewSound = AudioManager.PlaySound( Meta.PhysicsAudioFilename );
				Acid.SelectedActor.Sounds.push( NewSound );
			}
		}
	}
	
	if ( !Finished )
		return;
	
	//	hide hud
	Hud.Animal_Card.SetVisible(false);

	//	restore hint state
	Acid.EnableDragHint = Acid.RestoreDragHint;

	return Acid.State_Fly;
}


//	could be a better way to do this
const IntroSkipYears =
	[
		//1810
		Timeline_AllowIntroSkipAfterYear,
		1816,
		1823,
		//	in intro, skip OVER this subtitle="" to the next text, otherwise we skip, but text stays onscreen
		//TimelineBigBangStartYear,	//1826
		1831,
		1836,
		1842,
		1846,
		1849,
		1853,
		TimelineBigBangEndYear,	//	57
		TimelineSkipIntroToYear
	];
function GetNextIntroKeyframeYear(ThisYear,NoNextYearResult=undefined)
{
	for (let SkipYear of IntroSkipYears)
	{
		if (SkipYear <= ThisYear )
			continue;
		return SkipYear;
	}
	return NoNextYearResult;
}

function Acid_GetTime()
{
	return Params.TimelineYear;
}

function Update_Init(FirstUpdate,FrameDuration,StateTime)
{
	Pop.Debug("Acid Update_Init");
	//	setup scene stuff
	Scene_GetTime = Acid_GetTime;
	Scene_GetGlobalUniforms = Acid_GetGlobalUniforms;
	Scene_GetRenderScene = Acid_GetRenderScene;
	Scene_GetRenderCamera = Acid_GetRenderCamera;
	Scene_GetDebugTextures = Acid_GetDebugTextures;

	//	try and make camera move from logo's pos so we don't get a jump
	if (Logo.Camera)
		Acid.CameraPosition = Logo.Camera.Position.slice();

	Init();
	//	make sure hud's initialise properly
	Acid_Update(0);

	return 'Intro';
}


function Update_Intro(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		Acid.UserSkippedText = false;
		Hud.SubtitleSkipButton.OnClicked = function ()
		{
			Acid.UserSkippedText = true;
			Hud.SubtitleSkipButton.SetVisible(false);
		}

		Acid.UserSkippedIntro = false;
		Hud.IntroSkipButton.OnClicked = function ()
		{
			Acid.UserSkippedIntro = true;
			Hud.IntroSkipButton.SetVisible(false);
		}
	}
	function OnExit()
	{
		Hud.SubtitleSkipButton.SetVisible(false);
	}

	if (Params.TimelineYear >= Timeline_AllowIntroSkipAfterYear)
	{
		Hud.SubtitleSkipButton.SetVisible(true);
		Hud.IntroSkipButton.SetVisible(true);
	}

	//	if user skips, go to next keyframe
	if (Acid.UserSkippedText )
	{
		Acid.UserSkippedText = false;
		const NextYear = GetNextIntroKeyframeYear(Params.TimelineYear,null);
		Pop.Debug("Acid.UserSkippedText skipped to " + NextYear);
		Params.TimelineYear = NextYear;
	}

	if (Acid.UserSkippedIntro)
	{
		Params.TimelineYear = TimelineBigBangEndYear;
	}
	
	Acid_Update( FrameDuration );
	UpdateYearTime( FrameDuration );

	//	move camera
	{
		const TimelineCameraPos = GetTimelineCameraPosition( Params.TimelineYear );
		let TargetCameraPos = TimelineCameraPos;
		Acid.CameraPosition = Math.Lerp3( Acid.CameraPosition, TargetCameraPos, Params.ShowAnimal_CameraLerpOutSpeed );
	}
	
	UpdateFog(FrameDuration);
	
	//	fly until we hit big bang
	if (Params.TimelineYear >= TimelineBigBangStartYear)
	{
		OnExit();
		return Acid.State_BigBang;
	}
	
	//	stay flying
	return null;
}

function UpdateYearTime(FrameDuration)
{
	if ( !Params.ExperiencePlaying )
		return;
	
	const YearsPerFrame = FrameDuration * Params.YearsPerSecond;
	Params.TimelineYear += YearsPerFrame;
	if ( ParamsWindow )
		ParamsWindow.OnParamChanged('TimelineYear');
}

function UpdateCameraPos()
{
	const TimelineCameraPos = GetTimelineCameraPosition( Params.TimelineYear );
	let TargetCameraPos = TimelineCameraPos;
	Acid.CameraPosition = Math.Lerp3( Acid.CameraPosition, TargetCameraPos, Params.ShowAnimal_CameraLerpOutSpeed );
}

function Update_BigBang(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		Acid.UserSkippedText = false;
		Hud.SubtitleSkipButton.OnClicked = function ()
		{
			Acid.UserSkippedText = true;
			Hud.SubtitleSkipButton.SetVisible(false);
		}
	}
	function OnExit()
	{
		Hud.SubtitleSkipButton.SetVisible(false);
	}
	
	UpdateFog( FrameDuration );
	Acid_Update( FrameDuration );
	UpdateYearTime( FrameDuration );
	UpdateCameraPos();

	//	if user skips, go to next keyframe
	if (Acid.UserSkippedText)
	{
		Acid.UserSkippedText = false;
		const NextYear = GetNextIntroKeyframeYear(Params.TimelineYear,null);
		Pop.Debug("Acid.UserSkippedText/BigBang skipped to " + NextYear);
		Params.TimelineYear = NextYear;
	}
	else
	{
		Hud.SubtitleSkipButton.SetVisible(true);
	}

	if (Acid.UserSkippedIntro)
	{
		Params.TimelineYear = TimelineBigBangEndYear;
	}

	const Actors = {};
	function IsBigBangActor(Actor)
	{
		Actors[Actor.Name] = Actor;
		return Actor.Name.startsWith( BigBangAnimalPrefix );
	}
	const BigBangActors = GetActorScene( IsBigBangActor );
	function GetBigBangActor(ActorName)
	{
		return Actors[ActorName];
	}
	
	const CurrentYear = Params.TimelineYear;
	
	//	explode big bang actors at/after certain years
	function ExplodeActor(Year)
	{
		if ( Year > CurrentYear )
			return;
		const ActorName = BigBangExplodeYears[Year];
		const Actor = GetBigBangActor( ActorName );
		
		if ( !Actor )
		{
			Pop.Debug("Couldn't find actor named " + ActorName + " to explode");
			return;
		}

		if ( Actor.AnimalHasBeenExploded )
			return;
		Actor.EnablePhysics();
		Actor.AnimalHasBeenExploded = true;
		
		//	play a big bang sound
		const NewSound = AudioManager.PlaySound( ExplosionSoundFilename );
		Actor.Sounds.push( NewSound );
	}
	Object.keys(BigBangExplodeYears).forEach( ExplodeActor );
	
	
	if ( CurrentYear < TimelineBigBangEndYear )
		return null;
	
	return Acid.State_Fly;
}


function Update_Outro(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		//	set image url on the div so it starts loading
		const Url = 'url("Web/icons/Mosaic2_opa.png")';
		Pop.Debug("Set mosaic image ",Hud.Mosaic.Element)
		Hud.Mosaic.Element.style.backgroundImage = Url;
	}
	
	Acid_Update( FrameDuration );
	
	//	move time along
	UpdateYearTime( FrameDuration );
	
	//	move camera
	UpdateCameraPos();
	
	Acid.SelectedActor = null;
	
	UpdateFog(FrameDuration);

	if (Acid.UserRestarted)
	{
		Acid.UserRestarted = false;
		return Acid.State_RewindToStart;
	}

	//	fly until we reach end of timeline
	if ( Params.TimelineYear >= TimelineGalleryStartYear )
		return Acid.State_Gallery;
	
	//	stay flying
	return null;
}

function Update_Gallery(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
	}
	
	Acid_Update( FrameDuration );
	
	//	move time along
	UpdateYearTime( FrameDuration );
	
	//	move camera
	UpdateCameraPos();
	
	Acid.SelectedActor = null;
	
	UpdateFog(FrameDuration);

	if (Acid.UserRestarted)
	{
		Acid.UserRestarted = false;
		return Acid.State_RewindToStart;
	}
	
	if ( Params.TimelineYear >= TimelineSolutionYear )
		return Acid.State_Solution;
	
	//	stay flying
	return null;
}

function Update_Solution(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
	}
	
	Acid_Update(FrameDuration);

	if (Acid.UserRestarted)
	{
		Acid.UserRestarted = false;
		return Acid.State_RewindToStart;
	}
}


function Update_RewindToStart(FirstUpdate,FrameDuration,StateTime)
{
	if (FirstUpdate)
	{
	}

	Params.TimelineYear -= Params.RewindYearsPerSecond * FrameDuration;

	Acid_Update(FrameDuration);
	UpdateFog(FrameDuration);
	UpdateCameraPos();
	
	if (Params.TimelineYear <= TimelineRewindToYear)
	{
		Hud
		Params.TimelineYear = TimelineRewindToYear;
		return Acid.State_Intro;
	}
}

function Update_Fly(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
		Acid.UserSetYear = null;
		Hud.SubtitleSkipButton.SetVisible(false);
		Hud.IntroSkipButton.SetVisible(false);
		Hud.RestartButton.SetVisible(true);
		
		//	init very first camera pos
		if ( !Acid.CameraPosition )
		{
			Acid.CameraPosition = GetTimelineCameraPosition( Params.TimelineYear );
		}
	}

	Acid_Update( FrameDuration );
	
	//	move time along
	if ( Acid.UserSetYear !== null )
	{
		//	pop user's year
		Params.TimelineYear = Acid.UserSetYear;
		Acid.UserSetYear = null;
		if ( ParamsWindow )
			ParamsWindow.OnParamChanged('TimelineYear');
	}
	else
	{
		UpdateYearTime( FrameDuration );
	}

	//	move camera
	UpdateCameraPos();
	
	if (Acid.UserRestarted)
	{
		Acid.UserRestarted = false;
		return Acid.State_RewindToStart;
	}

	function GetActorFromUv(uv)
	{
		if ( !uv )
			return null;
		
		const IntersectedActors = GetActorIntersections(uv);
		if ( IntersectedActors.length == 0 )
			return null;
		
		let ActorSelectedActor = IntersectedActors[0].Actor;
		return ActorSelectedActor;
	}
	
	//	update highlight
	let HighlightedActor = GetActorFromUv( LastMouseRayUv );
	let HighlightedActorClicked = false;
	if ( LastMouseClicks.length > 0 )
	{
		let LastClickUv =  LastMouseClicks[LastMouseClicks.length-1];
		LastMouseClicks.length = 0;
		let LastClickActor = GetActorFromUv( LastClickUv );
		if ( LastClickActor )
		{
			HighlightedActor = LastClickActor;
			HighlightedActorClicked = true;
		}
	}

	Acid.SelectedActor = HighlightedActor;
	
	UpdateFog(FrameDuration);
	
	
	if ( HighlightedActorClicked )
	{
		return Acid.State_ShowAnimal;
	}
	
	//	fly until we hit a text time
	if ( Params.TimelineYear >= Timeline_Text1_Year )
	{
		if ( !Acid.TriggeredText1 )
		{
			Acid.TriggeredText1 = true;
			return Acid.State_TextTimeline1;
		}
	}
	
	if ( Params.TimelineYear >= Timeline_Text2_Year )
	{
		if ( !Acid.TriggeredText2 )
		{
			Acid.TriggeredText2 = true;
			return Acid.State_TextTimeline2;
		}
	}
	
	if ( Params.TimelineYear >= Timeline_Text3_Year )
	{
		if ( !Acid.TriggeredText3 )
		{
			Acid.TriggeredText3 = true;
			return Acid.State_TextTimeline3;
		}
	}
	
	//	fly until we reach end of timeline
	if ( Params.TimelineYear >= TimelineMaxInteractiveYear )
		return Acid.State_Outro;
	
	//	stay flying
	return null;
}


function Update_TextTimelineX(FirstUpdate,FrameDuration,StateTime,TextTimeline)
{
	if ( FirstUpdate )
	{
		Hud.SubtitleSkipButton.SetVisible(true);
		Hud.SubtitleSkipButton.OnClicked = function()
		{
			Acid.UserSkippedText = true;
		}
		Acid.UserSkippedText = false;
		Acid.TextTimelineSubTime = 0;
	}
	function OnExit()
	{
		Hud.SubtitleSkipButton.SetVisible(false);
	}
	
	Acid_Update(FrameDuration);
	UpdateYearTime(FrameDuration * Params.TextSectionYearTimeScale);

	//	update subtime
	if (Params.ExperiencePlaying)
	{
		Acid.TextTimelineSubTime += FrameDuration;
	}

	//	move camera
	UpdateCameraPos();

	//	gr: change these hud things after Update as it updates subtitles/hud for us
	Hud.Timeline.SetVisible( false );

	

	//	update text timeline
	const Subtitle = TextTimeline.GetUniform(Acid.TextTimelineSubTime,'Subtitle');
	Hud.SubtitleLabel.SetValue( Subtitle );
	Hud.SubtitleLabel.SetVisible( Subtitle.length > 0 );

	//	if user skips, jump to next keyframe in timeline
	if (Acid.UserSkippedText )
	{
		Acid.UserSkippedText = false;
		const LastTime = TextTimeline.LastKeyframeTime();
		const NextTime = TextTimeline.GetNextKeyframeTime(Acid.TextTimelineSubTime,LastTime);

		//	change offset to make next frame appear at the start of next keyframe
		Acid.TextTimelineSubTime = NextTime;
	}
	
	//	exit back to flying
	if (Acid.TextTimelineSubTime >= TextTimeline.LastKeyframeTime() )
	{
		OnExit();
		Pop.Debug('exit text timeline Update_TextTimelineX',Acid.TextTimelineSubTime,TextTimeline.LastKeyframeTime());
		return Acid.State_Fly;
	}
	
	return null;
}

function Update_TextTimeline1(FirstUpdate,FrameDuration,StateTime)
{
	const TextTimeline = Acid.TextTimeline1;
	return Update_TextTimelineX( FirstUpdate, FrameDuration, StateTime, TextTimeline );
}

function Update_TextTimeline2(FirstUpdate,FrameDuration,StateTime)
{
	const TextTimeline = Acid.TextTimeline2;
	return Update_TextTimelineX( FirstUpdate, FrameDuration, StateTime, TextTimeline );
}

function Update_TextTimeline3(FirstUpdate,FrameDuration,StateTime)
{
	const TextTimeline = Acid.TextTimeline3;
	return Update_TextTimelineX( FirstUpdate, FrameDuration, StateTime, TextTimeline );
}





let LastAudioState = null;

function Acid_Update(FrameDurationSecs)
{
	//	gr: continue physics even if paused
	//AppTime += FrameDurationSecs;
	AppTime += 1/60;

	const Timeline = Acid.Timeline;
	const Time = Params.TimelineYear;
	
	//	update audio
	const CurrentMusic = Timeline.GetUniform( Time, 'Music' );
	AudioManager.SetMusic( Params.EnableMusic ? CurrentMusic : null );
	
	const CurrentMusic2 = Timeline.GetUniform( Time, 'Music2' );
	AudioManager.SetMusic2( Params.EnableMusic ? CurrentMusic2 : null );

	if ( EnableVoiceOver )
	{
		const CurrentVoice = Timeline.GetUniform( Time, 'VoiceAudio' );
		AudioManager.PlayVoice( CurrentVoice );
	}

	//	trigger the audio manager watch
	//	gr: this should turn into a promise queue or something on the audio manager like a policy
	const NewAudioState = GetAudioOverrideState();
	if (NewAudioState != LastAudioState)
	{
		Pop.Debug("Manually triggering audio change");
		LastAudioState = NewAudioState;
		Pop.WebApi.SetIsForeground(undefined);
	}

	AudioManager.Update( FrameDurationSecs );

	//	update some stuff from timeline
	Params.FogColour = Timeline.GetUniform( Time, 'FogColour' );
	if ( ParamsWindow )
		ParamsWindow.OnParamChanged('FogColour');
	
	//	update hud
	Hud.YearLabel.SetValue( Math.floor(Params.TimelineYear) );
	Hud.YearSlider.SetValue( Params.TimelineYear );
	const MusicDebug = AudioManager.GetMusicQueueDebug();
	const Music2Debug = AudioManager.GetMusic2QueueDebug();
	const VoiceDebug = AudioManager.GetVoiceQueueDebug();
	const Subtitle = Timeline.GetUniform( Time, 'Subtitle' );
	Hud.MusicLabel.SetValue( MusicDebug );
	Hud.Music2Label.SetValue( Music2Debug );
	Hud.VoiceLabel.SetValue( VoiceDebug );
	Hud.SubtitleLabel.SetValue( Subtitle );
	Hud.SubtitleLabel.SetVisible( Subtitle.length > 0 );

	const DecimalPlaces = 2;
	const Stats_Temp = Timeline.GetUniform( Time, 'Stats_Temp' ).toFixed(DecimalPlaces);
	const Stats_Co2 = Timeline.GetUniform( Time, 'Stats_Co2' ).toFixed(DecimalPlaces);
	const Stats_Oxygen = Timeline.GetUniform( Time, 'Stats_Oxygen' ).toFixed(DecimalPlaces);
	const Stats_Ph = Timeline.GetUniform( Time, 'Stats_Ph' ).toFixed(DecimalPlaces);
	Hud.Stats_Temp.SetValue( Stats_Temp );
	Hud.Stats_Co2.SetValue( Stats_Co2 );
	Hud.Stats_Oxygen.SetValue( Stats_Oxygen );
	Hud.Stats_Ph.SetValue( Stats_Ph );
	
	Hud.Debug_State.SetValue( "State: " + Acid.StateMachine.CurrentState );
	
	UpdateDebugHud(Hud);

	
	//	update some huds
	const Hint_ClickAnimal_Visible = Timeline.GetUniform( Time, 'HintClickAnimalVisible' );
	const Hint_DragTimeline_Visible = Timeline.GetUniform( Time, 'HintDragTimelineVisible' );
	const Stats_Visible = Timeline.GetUniform( Time, 'StatsVisible' );
	const Timeline_Visible = Timeline.GetUniform(Time,'TimelineVisible');
	const Mosaic_Visible = Timeline.GetUniform(Time,'MosaicVisible');
	const Solution_Visible = Timeline.GetUniform(Time,'SolutionVisible');
	const RestartButtonVisible = Timeline.GetUniform(Time,'RestartButtonVisible');
	Hud.Hint_ClickAnimal.SetVisible( Hint_ClickAnimal_Visible && Acid.EnableClickHint );
	Hud.Hint_DragTimeline.SetVisible( Hint_DragTimeline_Visible && Acid.EnableDragHint );
	Hud.Stats.SetVisible( Stats_Visible );
	Hud.Timeline.SetVisible(Timeline_Visible);
	Hud.Mosaic.SetVisible(Mosaic_Visible);
	Hud.Solution.SetVisible(Solution_Visible);
	Hud.RestartButton.SetVisible(RestartButtonVisible);

	//	update colours
	if ( !Params.CustomiseWaterColours )
	{
		const UpdateReflection = true;	//	gr: thought this might be a hit updating the dom, but it's not
		const DebrisColours = Timeline.GetUniform( Time, 'DebrisColours' );
		const OceanColours = Timeline.GetUniform( Time, 'OceanColours' );
		const SwirlColours = Timeline.GetUniform( Time, 'SwirlColours' );

		function CopyValue(Value,Index,NamePrefix)
		{
			let Name = NamePrefix + Index;
			Params[Name] = Value || InvalidColour;
			if ( UpdateReflection )
				ParamsWindow.OnParamChanged(Name);
		}
		function CopyValues(Array,NamePrefix)
		{
			for ( let i=0;	i<10;	i++ )
				CopyValue( Array[i], i, NamePrefix );
		}
		CopyValues( DebrisColours, 'Debris_Colour' );
		CopyValues( OceanColours, 'Ocean_Colour' );
		CopyValues( SwirlColours, 'Swirl_Colour' );
	}
	
	UpdateColourTexture( FrameDurationSecs, OceanColourTexture, 'Ocean_Colour' );
	UpdateColourTexture( FrameDurationSecs, DebrisColourTexture, 'Debris_Colour' );
	UpdateColourTexture( FrameDurationSecs, SwirlColourTexture, 'Swirl_Colour' );

	//	update frame rate
	if ( !Params.CustomYearsPerSecond )
	{
		Params.YearsPerSecond = Timeline.GetUniform( Time, 'YearsPerSecond' );
		ParamsWindow.OnParamChanged('YearsPerSecond');
	}
	
	//	create some swirls
	let SwirlsEveryYears = Timeline.GetUniform( Time, 'CreateSwirlEveryXYears' );
	if ( Params.AlwaysCreateSwirls )
		SwirlsEveryYears = 3;
	if ( SwirlsEveryYears !== false )
	{
		//	first trigger, trigger NOW
		if ( !Acid.LastSwirlYear )
			Acid.LastSwirlYear = Time - SwirlsEveryYears;

		//	years since swirl
		const YearsSinceNewSwirl = Math.abs( Acid.LastSwirlYear - Time );
		if ( YearsSinceNewSwirl >= SwirlsEveryYears )
		{
			Pop.Debug("AddSwirlActor",Time,"SwirlsEveryYears",SwirlsEveryYears);
			AddSwirlActor();
			Acid.LastSwirlYear = Time;
		}
	}
	
	UpdateActorScene(FrameDurationSecs);
	
	//	mark actors visible this frame
	UpdateSceneVisibility(Time);
		
	UpdateNoise(FrameDurationSecs);
	
	const UpdateActorPhysics = function(RenderTarget)
	{
		const UpdateActorPhysics = function(Actor)
		{
			//	only update actors visible
			//	gr: maybe do this with the actors in scene from GetRenderScene?
			const UpdatePhysicsUniforms = function(Shader)
			{
				const Bounds = Actor.BoundingBox.Min.concat( Actor.BoundingBox.Max );
				Shader.SetUniform('OrigPositionsBoundingBox',Bounds);
			}
			Actor.PhysicsIteration( FrameDurationSecs, AppTime, RenderTarget, UpdatePhysicsUniforms );
		}
		
		const Scene = GetActorScene_OnlyVisible();
		
		//	update physics
		if ( PhysicsEnabled || PhsyicsUpdateCount == 0 )
		{
			try
			{
				Scene.forEach( UpdateActorPhysics );
				PhsyicsUpdateCount++;
			}
			catch(e)
			{
				Pop.Debug("UpdateActorPhysics error",e);
			}
		}
	}
	GpuJobs.push( UpdateActorPhysics );
	
	LastUpdateFrameDuration = FrameDurationSecs;
}


//	set the actor visibility for this frame
//	setup new animal actors where neccessary
function UpdateSceneVisibility(Time)
{
	const CullingCamera = GetTimelineCamera();
	const Rect = Window.GetScreenRect();
	const Viewport = [0,0,Rect[2],Rect[3]];
	const IsVisible = GetCameraActorCullingFilter( CullingCamera, Viewport );
	let VisibleActorCount = 0;
	const UpdateActorVisibility = function(Actor)
	{
		const WasVisible = Actor.IsVisible || false;
		Actor.IsVisible = IsVisible(Actor);
		if ( !WasVisible && Actor.IsVisible )
		{
			Pop.Debug("Actor " + Actor.Name + " now visible");
		}
		else if ( WasVisible && !Actor.IsVisible )
		{
			Pop.Debug("Actor " + Actor.Name + " now hidden");
			//	gr: we assume that if its hidden, its gone behind us
			//		if it's an animal, lets delete the texture data
			if ( IsAutoClearTextureActor(Actor) )
				Actor.ClearOpenglTextures();
			//	turn of any actor sounds
			Actor.Sounds.forEach( s => AudioManager.StopSound(s) );
			Actor.Sounds = [];

			//	if an animal exploded, and we've now reset the physics
			//	then they're no longer exploded, and when they're visible next time
			//	they'll be normal to the user, so let them select them again
			if ( Actor.AnimalHasBeenExploded )
			{
				Pop.Debug("Un-setting AnimalHasBeenExploded",Actor);
				Actor.AnimalHasBeenExploded = false;
				Actor.ResetPhysics();
			}
		}
		if ( Actor.IsVisible )
			VisibleActorCount++;
	}
	const Actors = GetActorScene( function(){return true;} );
	Actors.forEach( UpdateActorVisibility );
	
	Hud.Debug_VisibleActors.SetValue("Visible Actors: " + VisibleActorCount + "/" + Actors.length );
}


function Acid_GetGlobalUniforms()
{
	const FogParams = Acid.GetFogParams();

	let GlobalUniforms = Object.assign({},FogParams);
	GlobalUniforms = Object.assign(GlobalUniforms,Params);
	GlobalUniforms['Fog_MinDistance'] = FogParams.MinDistance;
	GlobalUniforms['Fog_MaxDistance'] = FogParams.MaxDistance;
	GlobalUniforms['Fog_Colour'] = Params.FogColour;
	GlobalUniforms['Fog_WorldPosition'] = FogParams.WorldPosition;

	return GlobalUniforms;
}

function OnSwitchedToDebugCamera()
{
	//	erk, not grabbing from single place
	let Year = Params.TimelineYear;
	
	//	snap debug camera to run from current viewing position
	let TimelineCamera = GetTimelineCamera();
	DebugCamera.Position = TimelineCamera.Position.slice();
	DebugCamera.LookAt = TimelineCamera.LookAt.slice();
}

function SwitchToDebugCamera(ForceAutoGrab)
{
	if ( Params.UseDebugCamera )
		return;
	
	//	auto grab always off in non debug
	if ( !IsDebugEnabled() )
		ForceAutoGrab = false;
	
	if ( ForceAutoGrab !== true )
		if ( !Params.AutoGrabDebugCamera )
			return;
	
	Params.UseDebugCamera = true;
	ParamsWindow.OnParamChanged('UseDebugCamera');
}

function Acid_GetDebugTextures()
{
	return [
		OceanColourTexture,
		DebrisColourTexture,
		SwirlColourTexture,
		RandomTexture,
		Noise_TurbulenceTexture,
	];
}

