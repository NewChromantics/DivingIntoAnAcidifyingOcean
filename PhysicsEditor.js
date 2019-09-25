Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopCinema4d.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopFrameCounter.js');
Pop.Include('PopEngineCommon/PopCamera.js');


const EnableVoiceOver = Pop.GetExeArguments().includes('EnableVoiceOver');
const BoldMode = Pop.GetExeArguments().includes('Bold');

const GeoVertShader = Pop.LoadFileAsString('Geo.vert.glsl');
const ColourFragShader = Pop.LoadFileAsString('Colour.frag.glsl');
const EdgeFragShader = Pop.LoadFileAsString('Edge.frag.glsl');

const AnimalParticleVertShader = Pop.LoadFileAsString('AnimalParticle.vert.glsl');
const AnimalParticleFragShader = Pop.LoadFileAsString('AnimalParticle.frag.glsl');

const Noise_TurbulenceFragShader = Pop.LoadFileAsString('Noise/TurbulencePerlin.frag.glsl');

const ExplosionSoundFilename = 'Audio/AcidicOcean_FX_Explosion.mp3';
const AnimalSelectedSoundFilename = 'Audio/AcidicOcean_FX_MouseClick.mp3';
const AnimalDissolveSoundFilename = 'Audio/AcidicOcean_FX_ShellDissolution.mp3';


//	temp turning off and just having dummy actors
const PhysicsEnabled = !Pop.GetExeArguments().includes('PhysicsDisabled');
var PhsyicsUpdateCount = 0;	//	gotta do one

var Debug_HighlightActors = [];

const AutoTriangleMeshCount = 256*512;	//	130k
const InvalidColour = [0,1,0];

const ShowDefaultActors = Pop.GetExeArguments().includes('ShowDefaultActors');
const OceanActorPrefix = 'Ocean_surface_';
const DebrisActorPrefix = 'Water_';
const NastyAnimalPrefix = 'Nasty_Animal_';
const BigBangAnimalPrefix = 'Bigbang_';
const AnimalActorPrefixs = ['Animal_',BigBangAnimalPrefix,NastyAnimalPrefix];
const IgnoreActorPrefixs = ['Camera_Spline'];
//const IgnoreActorPrefixs = ['Camera_Spline',OceanActorPrefix,DebrisActorPrefix];	//	nocrash?
//const IgnoreActorPrefixs = ['Camera_Spline',DebrisActorPrefix];	//	crash
//const IgnoreActorPrefixs = ['Camera_Spline',OceanActorPrefix];	//	crash

function SetupFileAssets()
{
	AssetFetchFunctions['AutoTriangleMesh'] = function(RenderTarget)	{	return GetAutoTriangleMesh( RenderTarget, AutoTriangleMeshCount );	};
}
SetupFileAssets();



//	colours from colorbrewer2.org
const FogColour = Pop.Colour.HexToRgbf(0x000000);
const LightColour = [0.86,0.95,0.94];


let DebugCamera = new Pop.Camera();
DebugCamera.Position = [ 0,0,0 ];
DebugCamera.LookAt = [ 0,0,-1 ];
DebugCamera.FarDistance = 400;	//	try not to clip anythig in debug mode



function IsAutoClearTextureActor(Actor)
{
	if ( Actor.Name.startsWith(OceanActorPrefix) )
	{
		//return false;
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




function GetDebrisMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = '.random';
	Meta.VertShader = AnimalParticleVertShader;
	Meta.FragShader = AnimalParticleFragShader;
	Meta.VelocityShader = ParticlePhysicsIteration_UpdateVelocity;
	Meta.PositionShader = ParticlePhysicsIteration_UpdatePosition;
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Debris_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Debris_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = RandomTexture;

	Meta.TriangleScale = Params.Debris_TriangleScale;
	Meta.Colours =
	[
	 Params.Debris_Colour0,
	 Params.Debris_Colour1,
	 Params.Debris_Colour2,
	 Params.Debris_Colour3,
	 Params.Debris_Colour4,
	 Params.Debris_Colour5,
	 Params.Debris_Colour6,
	 Params.Debris_Colour7,
	 Params.Debris_Colour8,
	 Params.Debris_Colour9,
	];
	Meta.FitToBoundingBox = true;
	return Meta;
}

function GetAnimalMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	if ( Actor && Actor.Animal && Actor.Animal.Scale !== undefined )
		Meta.LocalScale = Actor.Animal.Scale;
	
	Meta.LocalFlip = false;
	if ( Actor && Actor.Animal && Actor.Animal.LocalFlip !== undefined )
		Meta.LocalFlip = Actor.Animal.Flip;

	Meta.VertShader = AnimalParticleVertShader;
	Meta.FragShader = AnimalParticleFragShader;
	Meta.VelocityShader = ParticlePhysicsIteration_UpdateVelocity;
	Meta.PositionShader = ParticlePhysicsIteration_UpdatePosition;

	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Animal_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Animal_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = Noise_Turbulence;
	Meta.PhysicsUniforms.TinyNoiseScale = 0.1;
	
	Meta.TriangleScale = Params.Animal_TriangleScale;
	if ( Actor && Actor.Animal && Actor.Animal.TriangleScale !== undefined )
		Meta.TriangleScale = Actor.Animal.TriangleScale;

	Meta.Colours = [InvalidColour];
	return Meta;
}

function GetNastyAnimalMeta(Actor)
{
	let Meta = GetAnimalMeta(Actor);
	
	Meta.VelocityShader = ParticlePhysicsIteration_UpdateVelocityPulse;
	Meta.PositionShader = ParticlePhysicsIteration_UpdatePosition;

	Meta.PhysicsUniforms.NoiseScale = Params.NastyAnimal_PhysicsNoiseScale;
	Meta.PhysicsUniforms.SpringScale = Params.NastyAnimal_PhysicsSpringScale;
	Meta.PhysicsUniforms.Damping = Params.NastyAnimal_PhysicsDamping;
	Meta.PhysicsUniforms.ExplodeScale = Params.NastyAnimal_PhysicsExplodeScale;

	return Meta;
}


function GetBigBangAnimalMeta(Actor)
{
	let Meta = GetAnimalMeta(Actor);
	
	Meta.PhysicsUniforms.Noise = RandomTexture;
	Meta.PhysicsUniforms.Damping = Params.BigBang_Damping;
	Meta.PhysicsUniforms.NoiseScale = Params.BigBang_NoiseScale;
	Meta.PhysicsUniforms.TinyNoiseScale = Params.BigBang_TinyNoiseScale;
	
	return Meta;
}



//	store this somewhere else so the preload matches
var OceanFilenames = [];
let LoadOceanFrames = 96;
if ( Pop.GetExeArguments().includes('ShortOcean') )
	LoadOceanFrames = 4;
for ( let i=1;	i<=LoadOceanFrames;	i++ )
	OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');

function GetOceanMeta()
{
	const Meta = {};
	Meta.LocalScale = 1;
	Meta.Filename = OceanFilenames;
	Meta.VertShader = AnimalParticleVertShader;
	Meta.FragShader = AnimalParticleFragShader;
	Meta.PhysicsNoiseScale = 0;
	Meta.PhysicsDamping = 1;
	Meta.TriangleScale = Params.Ocean_TriangleScale;
	Meta.Colours =
	[
	 Params.Ocean_Colour0,
	 Params.Ocean_Colour1,
	 Params.Ocean_Colour2,
	 Params.Ocean_Colour3,
	 Params.Ocean_Colour4,
	];
	return Meta;
}

function GetMusicVolume()	{	return Params.MusicVolume;	}
function GetMusic2Volume()	{	return Params.Music2Volume;	}
function GetVoiceVolume()	{	return Params.VoiceVolume;	}
function GetSoundVolume()	{	return Params.SoundVolume;	}

var AppTime = null;


var LastMouseRay = null;	//	gr: this isn't getting updated any more
var LastMouseRayUv = null;
var LastMouseClicks = [];	//	array of queued uvs


var RenderFrameCounter = new Pop.FrameCounter();



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

//	move this to TActor once everything derives from it
function GetActorWorldBoundingBox(Actor)
{
	const LocalTransform = Actor.GetLocalToWorldTransform();
	const Scale = Math.GetMatrixScale( LocalTransform );
	const BoundingBoxLocal = Actor.GetBoundingBox();
	const Position = Math.GetMatrixTranslation( LocalTransform );
	
	//	todo: we should mult without rotating, or rotate and then get new min/max
	const BoundingBoxWorld = {};
	BoundingBoxWorld.Min = Math.Multiply3( BoundingBoxLocal.Min, Scale );
	BoundingBoxWorld.Max = Math.Multiply3( BoundingBoxLocal.Max, Scale );

	BoundingBoxWorld.Min = Math.Add3( BoundingBoxWorld.Min, Position );
	BoundingBoxWorld.Max = Math.Add3( BoundingBoxWorld.Max, Position );

	return BoundingBoxWorld;
}

function GetActorWorldBoundingBoxCorners(BoundingBoxWorld,IncludeBothX=true,IncludeBothY=true,IncludeBothZ=true)
{
	const Corners = [];
	const Min = BoundingBoxWorld.Min;
	const Max = BoundingBoxWorld.Max;
	
	//	save some processing time by only including things we need
	if ( IncludeBothZ && !IncludeBothX && !IncludeBothY )
	{
		const Mid = Math.Lerp3( Min, Max, 0.5 );
		Corners.push( [Mid[0], Mid[1], Min[2]] );
		Corners.push( [Mid[0], Mid[1], Max[2]] );
		return Corners;
	}
	
	Corners.push( [Min[0], Min[1], Min[2]] );
	Corners.push( [Max[0], Min[1], Min[2]] );
	Corners.push( [Max[0], Max[1], Min[2]] );
	Corners.push( [Min[0], Max[1], Min[2]] );
	Corners.push( [Min[0], Min[1], Max[2]] );
	Corners.push( [Max[0], Min[1], Max[2]] );
	Corners.push( [Max[0], Max[1], Max[2]] );
	Corners.push( [Min[0], Max[1], Max[2]] );
	
	return Corners;
}

function GetIntersectingActors(Ray,Scene)
{
	const Intersections = [];
	
	function TestIntersecting(Actor)
	{
		if ( !IsActorSelectable(Actor) )
			return;
		
		const BoundingBox = GetActorWorldBoundingBox( Actor );
		const IntersectionPos = Math.GetIntersectionRayBox3( Ray.Start, Ray.Direction, BoundingBox.Min, BoundingBox.Max );
		if ( !IntersectionPos )
			return;
		
		let Intersection = {};
		Intersection.Position = IntersectionPos;
		Intersection.Actor = Actor;
		Intersections.push( Intersection );
	}
	Scene.forEach( TestIntersecting );
	
	return Intersections;
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
	const Camera = Params.MouseRayOnTimelineCamera ? GetTimelineCamera() : GetRenderCamera();
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

//	returns signed distance, so if negative, point is behind plane.
Math.GetDistanceToPlane = function(Plane4,Position3)
{
	//	plane should be normalised
	const Distance = Math.Dot3( Position3, Plane4 ) + Plane4[3];
	return Distance;
	/*
	// n must be normalized
	return dot(p,n.xyz) + n.w;
	
	const a = Plane4[0];
	const b = Plane4[1];
	const c = Plane4[2];
	const d = Plane4[3];
	const x = Position3[0];
	const y = Position3[1];
	const z = Position3[2];
	const Distance = (a * x + b * y + c * z + d);
	return Distance;
	*/
}

Math.InsideMinusOneToOne = function(f)
{
	return ( f>=-1 && f<= 1 );
}

Math.PositionInsideBoxXZ = function(Position3,Box3)
{
	if ( Position3[0] < Box3.Min[0] )	return false;
	//if ( Position3[1] < Box3.Min[1] )	return false;
	if ( Position3[2] < Box3.Min[2] )	return false;
	if ( Position3[0] > Box3.Max[0] )	return false;
	//if ( Position3[1] > Box3.Max[1] )	return false;
	if ( Position3[2] > Box3.Max[2] )	return false;
	return true;
}

//	return the filter function
function GetCameraActorCullingFilter(Camera,Viewport)
{
	//	get a matrix to convert world space to camera frustum space (-1..1)
	const WorldToFrustum = Camera.GetWorldToFrustumTransform(Viewport);
	
	const IsVisibleFunction = function(Actor)
	{
		const TestBounds = true;
		
		const IsWorldPositionVisible = function(WorldPosition)
		{
			//const WorldPosition = Math.GetMatrixTranslation( ActorTransform, true );
			const PosInWorldMtx = Math.CreateTranslationMatrix( ...WorldPosition );
			const PosInFrustumMtx = Math.MatrixMultiply4x4( WorldToFrustum,  PosInWorldMtx );
			const PosInFrustumPos = Math.GetMatrixTranslation(  PosInFrustumMtx, true );
			
			if ( Params.FrustumCullTestX && !Math.InsideMinusOneToOne( PosInFrustumPos[0] ) )	return false;
			if ( Params.FrustumCullTestY && !Math.InsideMinusOneToOne( PosInFrustumPos[1] ) )	return false;
			if ( Params.FrustumCullTestZ && !Math.InsideMinusOneToOne( PosInFrustumPos[2] ) )	return false;
			
			return true;
		}
		
		if ( TestBounds )
		{
			const WorldBounds = GetActorWorldBoundingBox( Actor );
			if ( Math.PositionInsideBoxXZ( Camera.Position, WorldBounds ) )
				return true;
			
			const WorldBoundsCorners = GetActorWorldBoundingBoxCorners( WorldBounds, Params.FrustumCullTestX, Params.FrustumCullTestY, Params.FrustumCullTestZ );
			return WorldBoundsCorners.some( IsWorldPositionVisible );
		}
		else
		{
			const ActorTransform = Actor.GetLocalToWorldTransform();
			const ActorPosition = Math.GetMatrixTranslation( ActorTransform );
			return IsWorldPositionVisible( ActorPosition );
		}
		
	}

	return IsVisibleFunction;
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
	
	Debug_HighlightActors = GetActorIntersections(CameraScreenUv);
	if ( Debug_HighlightActors.length )
	{
		const Names = Debug_HighlightActors.map( a => a.Actor.Name );
		//Pop.Debug("Selected actors;", Names );
	}
}


function GetActorIntersections(CameraScreenUv)
{
	const Rect = Window.GetScreenRect();
	
	//Pop.Debug(CameraScreenUv);
	const Time = Params.TimelineYear;
	const Viewport = [0,0,Rect[2],Rect[3]];
	
	const Ray = GetMouseRay( CameraScreenUv );
	
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
	
	//	find actor
	const Scene = GetActorScene( FilterActor );
	const SelectedActors = GetIntersectingActors( Ray, Scene );
	
	return SelectedActors;
}



const TimelineMinYear = 1800;
const TimelineBigBangYear = 1823;
const TimelineMinInteractiveYear = 1860;
const TimelineMaxYear = 2160;
const TimelineMaxInteractiveYear = 2100;
const TimelineSolutionYear = 2146;

const BigBangDuration = 10;

Params.TimelineYear = TimelineMinYear;
Params.YearsPerSecond = 1;
Params.CustomYearsPerSecond = false;
Params.ShowAnimal_ExplodeSecs = 3;
Params.ShowAnimal_Duration = 40;
Params.ShowAnimal_CameraOffsetX = 0.32;
Params.ShowAnimal_CameraOffsetY = 0.44;
Params.ShowAnimal_CameraOffsetZ = 3.52;
Params.ShowAnimal_CameraLerpInSpeed = 0.275;
Params.ShowAnimal_CameraLerpOutSpeed = 0.10;
Params.AnimalBufferLod = 1.0;
Params.DebugCullTimelineCamera = true;
Params.TransposeFrustumPlanes = false;
Params.FrustumCullTestX = false;	//	re-enable when we cull on bounding box
Params.FrustumCullTestY = false;	//	re-enable when we cull on bounding box
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
Params.FogMinDistance = 8.0;
Params.FogMaxDistance = BoldMode ? 999 : 20.0;
Params.FogHighlightMinDistance = 0.8;
Params.FogHighlightMaxDistance = 2.7;
Params.FogColour = FogColour;
Params.FogParamsLerpSpeed = 0.1;
Params.FogTargetLerpSpeed = 0.2;
Params.LightColour = LightColour;
Params.DebugPhysicsTextures = false;
Params.DebugNoiseTextures = IsDebugEnabled();
Params.BillboardTriangles = true;
Params.ShowClippedParticle = false;
Params.CameraNearDistance = 0.1;
Params.CameraFarDistance = 24;	//	under 20 and keeps clipping too easily
Params.AudioCrossFadeDurationSecs = 2;
Params.OceanAnimationFrameRate = 25;
Params.DrawBoundingBoxes = true;
Params.DrawBoundingBoxesFilled = false;
Params.DrawHighlightedActors = true;
Params.DebugIntersectionSize = 0.08;
Params.ScrollFlySpeed = 2;

Params.BigBang_Damping = 0.01;
Params.BigBang_NoiseScale = 0.01;
Params.BigBang_TinyNoiseScale = 0.5;

Params.Animal_TriangleScale = 0.01;
Params.Animal_PhysicsDamping = 0.12;
Params.Animal_PhysicsNoiseScale = 16.0;
Params.NastyAnimal_PhysicsNoiseScale = 0.45;
Params.NastyAnimal_PhysicsSpringScale = 0.65;
Params.NastyAnimal_PhysicsDamping = 0.01;
Params.NastyAnimal_PhysicsExplodeScale = 3.1;

Params.Debris_TriangleScale = BoldMode ? 0.09 : 0.025;
Params.Debris_PhysicsDamping = 0.04;
Params.Debris_PhysicsNoiseScale = 9.9;

Params.CustomiseWaterColours = false;
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
Params.Ocean_TriangleScale = BoldMode ? 0.2 : 0.0148;
Params.Ocean_Colour0 = InvalidColour;
Params.Ocean_Colour1 = InvalidColour;
Params.Ocean_Colour2 = InvalidColour;
Params.Ocean_Colour3 = InvalidColour;
Params.Ocean_Colour4 = InvalidColour;
Params.Ocean_Colour5 = InvalidColour;
Params.Ocean_Colour6 = InvalidColour;
Params.Ocean_Colour7 = InvalidColour;
Params.Ocean_Colour8 = InvalidColour;
Params.Ocean_Colour9 = InvalidColour;

Params.Turbulence_Frequency = 4.0;
Params.Turbulence_Amplitude = 1.0;
Params.Turbulence_Lacunarity = 0.10;
Params.Turbulence_Persistence = 0.20;
Params.Turbulence_TimeScalar = 0.14;

Params.AnimalScale = 1.0;
Params.AnimalFlip = false;
Params.AnimalDebugParticleColour = false;

let OnParamsChanged = function(Params,ChangedParamName)
{
	if ( ChangedParamName == 'UseDebugCamera' && Params.UseDebugCamera )
		OnSwitchedToDebugCamera();
}

let ParamsWindow = {};
ParamsWindow.OnParamChanged = function(){};

if ( IsDebugEnabled() )
{
	const ParamsWindowRect = [1200,20,350,200];
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
	ParamsWindow.AddParam('DebugNoiseTextures');
	ParamsWindow.AddParam('AnimalBufferLod',0,1);

	ParamsWindow.AddParam('AutoGrabDebugCamera');
	ParamsWindow.AddParam('FogColour','Colour');
	ParamsWindow.AddParam('LightColour','Colour');

	ParamsWindow.AddParam('FogMinDistance',0,50);
	ParamsWindow.AddParam('FogMaxDistance',0,50);
	ParamsWindow.AddParam('FogHighlightMinDistance',0,50);
	ParamsWindow.AddParam('FogHighlightMaxDistance',0,50);
	ParamsWindow.AddParam('FogParamsLerpSpeed',0,1);
	ParamsWindow.AddParam('EnableMusic');
	ParamsWindow.AddParam('DrawBoundingBoxes');
	ParamsWindow.AddParam('DrawBoundingBoxesFilled');
	ParamsWindow.AddParam('AudioCrossFadeDurationSecs',0,10);
	ParamsWindow.AddParam('OceanAnimationFrameRate',1,60);

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
	ParamsWindow.AddParam('EnablePhysicsIteration');
	ParamsWindow.AddParam('DebugPhysicsTextures');
	ParamsWindow.AddParam('BillboardTriangles');
	ParamsWindow.AddParam('ShowClippedParticle');
	ParamsWindow.AddParam('CameraNearDistance', 0.01, 10);
	ParamsWindow.AddParam('CameraFarDistance', 1, 100);
	ParamsWindow.AddParam('ScrollFlySpeed',1,300);
	
	
	ParamsWindow.AddParam('NastyAnimal_PhysicsNoiseScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsSpringScale',0,1);
	ParamsWindow.AddParam('NastyAnimal_PhysicsExplodeScale',0,10);
	ParamsWindow.AddParam('NastyAnimal_PhysicsDamping',0,1);

	ParamsWindow.AddParam('BigBang_Damping',0,1);
	ParamsWindow.AddParam('BigBang_NoiseScale',0,5);
	ParamsWindow.AddParam('BigBang_TinyNoiseScale',0,20);

	
	ParamsWindow.AddParam('Debris_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Debris_PhysicsDamping',0,1);
	ParamsWindow.AddParam('Debris_PhysicsNoiseScale',0,1);
	ParamsWindow.AddParam('CustomiseWaterColours');
	
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
	ParamsWindow.AddParam('Ocean_TriangleScale',0.001,0.2);
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

	
	ParamsWindow.AddParam('Animal_TriangleScale',0.001,0.2);
	ParamsWindow.AddParam('Animal_PhysicsDamping',0,1);
	ParamsWindow.AddParam('Animal_PhysicsNoiseScale',0,20);
	ParamsWindow.AddParam('Turbulence_Frequency',0,4);
	ParamsWindow.AddParam('Turbulence_Amplitude',0,4);
	ParamsWindow.AddParam('Turbulence_Lacunarity',0,4);
	ParamsWindow.AddParam('Turbulence_Persistence',0,4);
	ParamsWindow.AddParam('Turbulence_TimeScalar',0,10);

	ParamsWindow.AddParam('AnimalScale',0,2);
	ParamsWindow.AddParam('AnimalFlip');
	ParamsWindow.AddParam('AnimalDebugParticleColour');
}


function LoadAssetGeoTextureBuffer(RenderTarget)
{
	let Filename = this;
	const MaxPositions = AutoTriangleMeshCount;

	//	load texture buffer formats
	const CachedTextureBufferFilename = GetCachedFilename(Filename,'texturebuffer.png');
	if ( Pop.FileExists(CachedTextureBufferFilename) )
	{
		const Contents = Pop.LoadFileAsImage(CachedTextureBufferFilename);
		const GeoTextureBuffers = LoadPackedImage( Contents );
		return GeoTextureBuffers;
	}
	
	const CachedGeoFilename = GetCachedFilename(Filename,'geometry');
	if ( Pop.FileExists(CachedGeoFilename) )
		Filename = CachedGeoFilename;
	
	//	load positions, colours
	const Geo = LoadGeometryFile( Filename );
	const GeoTextureBuffers = LoadGeometryToTextureBuffers( Geo, MaxPositions );
	return GeoTextureBuffers;
}

const FakeRenderTarget = {};

function SetupAnimalTextureBufferActor(Filename,GetMeta)
{
	const Meta = GetMeta(this);
	this.Geometry = 'AutoTriangleMesh';
	this.VertShader = Meta.VertShader;
	this.FragShader = Meta.FragShader;
	this.UpdateVelocityShader = Meta.VelocityShader;
	this.UpdatePositionShader = Meta.PositionShader;
	this.UpdatePhysics = false;

	if ( Meta.FitToBoundingBox )
	{
		//	box is local space, but world size
		let BoxScale = Math.Subtract3( this.BoundingBox.Max, this.BoundingBox.Min );
		let Position = Math.GetMatrixTranslation( this.LocalToWorldTransform );
		//	points are 0-1 so we need to move our offset (and bounds)
		let BoxOffset = Math.Multiply3( BoxScale, [0.5,0.5,0.5] );
		Position = Math.Subtract3( Position, BoxOffset );
		let Scale = BoxScale;
		this.LocalToWorldTransform = Math.CreateTranslationScaleMatrix( Position, Scale );
		//	bounds match mesh!
		this.BoundingBox.Min = [0,0,0];
		this.BoundingBox.Max = [1,1,1];
		Pop.Debug("Fit bounding box transform",this.LocalToWorldTransform,this);
	}
	
	this.LoadAssets = function()
	{
		Pop.Debug("Loading assets for ",Filename,"-----------------------------_");
		
		//	handle array for animation
		if ( Array.isArray(Filename) )
		{
			const LoadFrame = function(Filename)
			{
				AssetFetchFunctions[Filename] = LoadAssetGeoTextureBuffer.bind(Filename);
				const Buffers = GetAsset( Filename, FakeRenderTarget );
				
				//	set at least one to grab colours
				this.TextureBuffers = Buffers;
				this.PositionAnimationTextures.push( Buffers.PositionTexture );
			}
			this.PositionAnimationTextures = [];
			Filename.forEach( LoadFrame.bind(this) );
		}
		else
		{
			//	setup the fetch func on demand, if already cached, won't make a difference
			AssetFetchFunctions[Filename] = LoadAssetGeoTextureBuffer.bind(Filename);
			this.TextureBuffers = GetAsset( Filename, FakeRenderTarget );
		}
		
		if ( !Meta.FitToBoundingBox )
		{
			//	update bounding box to use geo
			if ( this.TextureBuffers.BoundingBox )
				this.BoundingBox = this.TextureBuffers.BoundingBox;
		}
		
		//	invalidate caches
		this.PositionTexture = null;

		//	reload if changes
		AssetManager.WaitForAssetChange(Filename).then( this.LoadAssets );
	}
	this.LoadAssets();
	
	
	this.GetPositionTexture = function(Time)
	{
		//	is animation
		if ( this.PositionAnimationTextures )
		{
			let FrameDuration = 1 / Params.OceanAnimationFrameRate;
			let AnimDuration = this.PositionAnimationTextures.length * FrameDuration;
			let NormalisedTime = (Time % AnimDuration) / AnimDuration;
			let FrameIndex = Math.floor( NormalisedTime * this.PositionAnimationTextures.length );
			//Pop.Debug("FrameIndex",FrameIndex,this.PositionAnimationTextures.length);
			return this.PositionAnimationTextures[FrameIndex];
		}
		
		//	position texture is copy from original source
		if ( this.PositionTexture )
			return this.PositionTexture;

		return this.TextureBuffers.PositionTexture;
	}

	this.ResetPhysicsTextures = function()
	{
		if ( !this.TextureBuffers )
			throw "Not ready to setup physics yet, no texture buffers";
		
		//	make copy of original reference!
		this.PositionTexture = new Pop.Image();
		this.PositionTexture.Copy( this.TextureBuffers.PositionTexture );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float3');
		this.ScratchTexture = new Pop.Image(Size,'Float3');
		this.PositionOrigTexture = this.TextureBuffers.PositionTexture;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
		if ( !this.UpdatePhysics )
			return;

		if ( !this.VelocityTexture )
		{
			this.ResetPhysicsTextures();
		}
		
		const Meta = GetMeta(this);
		const SetAnimalPhysicsUniforms = function(Shader)
		{
			SetPhysicsUniforms(Shader);
			
			function ApplyUniform(UniformName)
			{
				const Value = Meta.PhysicsUniforms[UniformName];
				Shader.SetUniform( UniformName, Value );
			}
			Object.keys( Meta.PhysicsUniforms ).forEach( ApplyUniform );
		}
		
		PhysicsIteration( RenderTarget, Time, DurationSecs, this.PositionTexture, this.VelocityTexture, this.ScratchTexture, this.PositionOrigTexture, this.UpdateVelocityShader, this.UpdatePositionShader, SetAnimalPhysicsUniforms );
	}
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const Actor = this;
		
		const Geo = GetAsset( this.Geometry, RenderTarget );
		const Shader = Pop.GetShader( RenderTarget, this.FragShader, this.VertShader );
		const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];
		const PositionTexture = this.GetPositionTexture(Time);
		const ColourTexture = this.TextureBuffers.ColourTexture;
		const AlphaTexture = this.TextureBuffers.AlphaTexture;
		const LocalToWorldTransform = this.GetLocalToWorldTransform();
		
		const Meta = GetMeta(this);
		const Colours = Meta.Colours;
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );
			Shader.SetUniform('ShowClippedParticle', Params.ShowClippedParticle );
			Shader.SetUniform('LocalToWorldTransform', LocalToWorldTransform );
			Shader.SetUniform('LocalPositions', LocalPositions );
			Shader.SetUniform('BillboardTriangles', Params.BillboardTriangles );
			Shader.SetUniform('WorldPositions',PositionTexture);
			Shader.SetUniform('WorldPositionsWidth',PositionTexture.GetWidth());
			Shader.SetUniform('WorldPositionsHeight',PositionTexture.GetHeight());
			Shader.SetUniform('TriangleScale', Meta.TriangleScale );
			if ( ColourTexture )
			{
				Shader.SetUniform('ColourImage',ColourTexture);
				Shader.SetUniform('ColourImageValid', true );
			}
			else
			{
				//	NOT setting this image was cause of crash on some intel graphics cards (macbook air 2015, intel graphics 6000)
				Shader.SetUniform('ColourImage',RandomTexture);
				Shader.SetUniform('ColourImageValid', false );
			}
		
			Shader.SetUniform('Colours', Colours );
			Shader.SetUniform('ColourCount', Colours.length );
			Shader.SetUniform('Debug_ForceColour',Params.AnimalDebugParticleColour);
		}
		
		//	limit number of triangles
		//	gr: why is this triangle count so much bigger than the buffer?
		let TriangleCount = Math.min( AutoTriangleMeshCount, Actor.TextureBuffers.TriangleCount ) || AutoTriangleMeshCount;
		TriangleCount = Math.floor( TriangleCount * Params.AnimalBufferLod );
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms, TriangleCount );
	}

	this.GetLocalToWorldTransform = function()
	{
		const Meta = GetMeta(this);
		let Scale = Meta.LocalScale * Params.AnimalScale;
		let Scale3 = [Scale,Scale,Scale];
		if ( Meta.LocalFlip )
			Scale3[1] *= -1;
		//	allow flip of the flip
		if ( Params.AnimalFlip )
			Scale3[1] *= -1;
		let ScaleMtx = Math.CreateScaleMatrix( ...Scale3 );
		
		let Transform = Math.MatrixMultiply4x4( this.LocalToWorldTransform, ScaleMtx );
		return Transform;
	}

	this.ClearOpenglTextures = function()
	{
		function ClearTexture(Image)
		{
			if ( !Image )
				return;
			Image.DeleteOpenglTexture();
		}
		
		if ( this.PositionAnimationTextures )
			this.PositionAnimationTextures.forEach(ClearTexture);
		
		ClearTexture( this.PositionTexture );
		ClearTexture( this.VelocityTexture );
		ClearTexture( this.ScratchTexture );
		//ClearTexture( this.PositionOrigTexture );
	}

}



function LoadCameraScene(Filename)
{
	let Scene = [];
	
	let OnActor = function(ActorNode)
	{
		if ( IgnoreActorPrefixs.some( MatchName => ActorNode.Name.includes(MatchName) ) )
		{
			Pop.Debug("Ignoring actor node " + ActorNode.Name, ActorNode );
			return;
		}
		
		Pop.Debug("Loading actor", ActorNode.Name, ActorNode );
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
		
		//	there are some new objects with no bounding boxes or geo,
		//	but they're not ones we want to turn to animals anyway
		let IsAnimalActor = IsActorSelectable(Actor);
		const IsDebrisActor = ActorNode.Name.startsWith(DebrisActorPrefix);
		const IsOceanActor = ActorNode.Name.startsWith(OceanActorPrefix);
		
		
		if ( ShowDefaultActors )
			IsAnimalActor = false;
		
		const IsParticleActor = IsAnimalActor || IsDebrisActor || IsOceanActor;
		
		//if ( !ShowDefaultActors && IsParticleActor )
		if ( IsParticleActor )
		{
			//let LocalScale = ActorNode.Scale;
			let WorldPos = ActorNode.Position;
			Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...WorldPos );
			Actor.BoundingBox = ActorNode.BoundingBox;
			
			if ( IsOceanActor )
			{
				SetupAnimalTextureBufferActor.call( Actor, GetOceanMeta().Filename, GetOceanMeta );
			}
			else if ( IsDebrisActor )
			{
				SetupAnimalTextureBufferActor.call( Actor, GetDebrisMeta().Filename, GetDebrisMeta );
			}
			else
			{
				const Animal = GetRandomAnimal( ActorNode.Name );
				Actor.Animal = Animal;
				Actor.Name += " " + Animal.Name;
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
			
			Actor.VertShader = GeoVertShader;
			Actor.FragShader = ColourFragShader;
			Actor.BoundingBox = ActorNode.BoundingBox;
		}
		Scene.push( Actor );
	}
	
	//	create a dumb actor
	let PreviewActorNode = {};
	//PreviewActorNode.Name = BigBangAnimalPrefix + "Kelp";
	PreviewActorNode.Name = "Animal_xxx";
	PreviewActorNode.BoundingBox = {};
	PreviewActorNode.BoundingBox.Min = [-10,-10,-10];
	PreviewActorNode.BoundingBox.Max = [10,10,10];
	PreviewActorNode.Scale = [1,1,1];
	PreviewActorNode.Position = [0,0,0];

	OnActor( PreviewActorNode );

	return Scene;
}

function GetTimelineCamera()
{
	let Camera = new Pop.Camera();
	Camera.Position = [0,0,1.0];
	Camera.LookAt = [0,0,0];
	
	Camera.NearDistance = Params.CameraNearDistance;
	Camera.FarDistance = Params.CameraFarDistance;
	return Camera;
}

function GetRenderCamera()
{
	if ( Params.UseDebugCamera )
		return DebugCamera;
	
	return GetTimelineCamera();
}


function TActor(Transform,Geometry,VertShader,FragShader,Uniforms)
{
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.VertShader = VertShader;
	this.FragShader = FragShader;
	this.Uniforms = Uniforms || [];
	this.BoundingBox = null;
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget,SetPhysicsUniforms)
	{
	}
	
	this.Render = function(RenderTarget, ActorIndex, SetGlobalUniforms, Time)
	{
		const Geo = GetAsset( this.Geometry, RenderTarget );
		const Shader = Pop.GetShader( RenderTarget, this.FragShader, this.VertShader );
		const LocalToWorldTransform = this.GetLocalToWorldTransform();
		
		const SetUniforms = function(Shader)
		{
			SetGlobalUniforms( Shader );
			Shader.SetUniform('LocalToWorldTransform', LocalToWorldTransform );
		}
		
		RenderTarget.DrawGeometry( Geo, Shader, SetUniforms );
	}
	
	this.GetLocalToWorldTransform = function()
	{
		return this.LocalToWorldTransform;
	}
	
	this.GetBoundingBox = function()
	{
		return this.BoundingBox;
	}
	
	this.ClearOpenglTextures = function()
	{
		
	}
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
	
	CameraScene.forEach( PushCameraSceneActor );
	
	return Scene;
}


//	get scene graph
function GetRenderScene(Time,VisibleFilter)
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
		BoundsActor.VertShader = GeoVertShader;
		BoundsActor.FragShader = EdgeFragShader;
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
		const BoundingBox = Actor.GetBoundingBox();
		if ( !BoundingBox )
		{
			Pop.Debug("Actor has no bounds",Actor);
			return;
		}
		
		PushActorBox( Actor.GetLocalToWorldTransform(), BoundingBox.Min, BoundingBox.Max );
	}
	
	let PushDebugCameraActor = function()
	{
		let Camera = GetTimelineCamera();
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Camera.GetLocalToWorldFrustumTransformMatrix();
		Actor.Geometry = 'Cube';
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = EdgeFragShader;
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
		Actor.VertShader = GeoVertShader;
		Actor.FragShader = ColourFragShader;
		Scene.push( Actor );
	}
	
	const ActorScene = GetActorScene( VisibleFilter );
	ActorScene.forEach( a => PushActorBoundingBox(a) );
	ActorScene.forEach( a => Scene.push(a) );
	
	
	if ( Params.UseDebugCamera )
	{
		PushDebugCameraActor();
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
		let TestSize = Params.DebugIntersectionSize / 2;
		let Min = [-TestSize,-TestSize,-TestSize];
		let Max = [TestSize,TestSize,TestSize];
		PushActorBox( Pos, Min, Max, true );
	}
	if ( Params.DrawHighlightedActors )
		Debug_HighlightActors.forEach( DrawIntersection );
	
	return Scene;
}


function GetAudioGetCrossFadeDuration()
{
	return Params.AudioCrossFadeDurationSecs;
}


var Hud = {};

//	need a better place for this, app state!
function Init()
{
	AppTime = 0;
	
	Hud.MusicLabel = new Pop.Hud.Label('AudioMusicLabel');
	Hud.Music2Label = new Pop.Hud.Label('AudioMusic2Label');
	Hud.VoiceLabel = new Pop.Hud.Label('AudioVoiceLabel');
	Hud.SubtitleLabel = new Pop.Hud.Label('SubtitleLabel');
	Hud.Timeline = new Pop.Hud.Label('TimelineContainer');
	Hud.YearLabel = new Pop.Hud.Label('YearLabel');
	Hud.YearSlider = new Pop.Hud.Slider('YearSlider');
	Hud.YearSlider.SetMinMax( TimelineMinInteractiveYear, TimelineMaxInteractiveYear );
	Hud.YearSlider.OnChanged = function(NewValue)
	{
		Pop.Debug("Slider changed",NewValue);
		Acid.UserSetYear = NewValue;
	}
	
	Hud.Stats = new Pop.Hud.Label('Stats');
	Hud.Stats_Temp = new Pop.Hud.Label('Stats_Temp_Label');
	Hud.Stats_Co2 = new Pop.Hud.Label('Stats_Co2_Label');
	Hud.Stats_Oxygen = new Pop.Hud.Label('Stats_Oxygen_Label');
	Hud.Stats_Ph = new Pop.Hud.Label('Stats_Ph_Label');
		
	Hud.Animal_Card = new Pop.Hud.Label('AnimalCard');
	Hud.Animal_Title = new Pop.Hud.Label('AnimalCard_Title');
	Hud.Animal_Description = new Pop.Hud.Label('AnimalCard_Description');
	Hud.Animal_ContinueButton = new Pop.Hud.Button('Continue');

	if ( IsDebugEnabled() )
	{
		let DebugHud = new Pop.Hud.Label('Debug');
		DebugHud.SetVisible(true);
	}
	Hud.Debug_State = new Pop.Hud.Label('Debug_State');
	Hud.Debug_VisibleActors = new Pop.Hud.Label('Debug_VisibleActors');
	Hud.Debug_RenderedActors = new Pop.Hud.Label('Debug_RenderedActors');
	Hud.Debug_RenderStats = new Pop.Hud.Label('Debug_RenderStats');
	Hud.Debug_FrameRate = new Pop.Hud.Label('Debug_FrameRate');
	Hud.Debug_TextureHeap = new Pop.Hud.Label('Debug_TextureHeap');
	Hud.Debug_GeometryHeap = new Pop.Hud.Label('Debug_GeometryHeap');

	Hud.Animal_Card.SetVisible(false);
	
	Hud.Hint_ClickAnimal = new Pop.Hud.Label('Hint_ClickAnimal');
	Hud.Hint_DragTimeline = new Pop.Hud.Label('Hint_DragTimeline');

	
	RenderFrameCounter.Report = function(CountPerSec)
	{
		Hud.Debug_FrameRate.SetValue( CountPerSec.toFixed(2) + " fps" );
	}
}

var Acid = {};
Acid.StateMap =
{
	'Init':		Update_Init,
	'Physics':	Update_Physics,
};
Acid.StateMachine = new Pop.StateMachine( Acid.StateMap, 'Init', 'Init', false );



function GetActorWorldPos(Actor)
{
	const Transform = Actor.GetLocalToWorldTransform();
	return Math.GetMatrixTranslation( Transform );
}


function Update_Init(FirstUpdate,FrameDuration,StateTime)
{
	//	reload scene which generates a new actor
	CameraScene = LoadCameraScene();
	
	const Scene = GetActorScene();
	function InitActor(Actor)
	{
		Actor.ResetPhysicsTextures();
		//Actor.UpdatePhysics = true;
	}
	Scene.forEach(InitActor);
	return 'Physics';
}

function Update_Physics(FirstUpdate,FrameDuration,StateTime)
{
	if ( FirstUpdate )
	{
	}

	Update( FrameDuration );
	
	UpdateFog(FrameDuration);
	
	if ( StateTime > 5 )
		return 'Init';
}

function UpdateAudio()
{
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
	AudioManager.Update( FrameDurationSecs );
}

function UpdateFog(FrameDurationSecs)
{
	
}

function UpdateHud()
{
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
	
	try
	{
		const TextureHeapCount = Window.TextureHeap.AllocCount;
		const TextureHeapSizeMb = Window.TextureHeap.AllocSize / 1024 / 1024;
		Hud.Debug_TextureHeap.SetValue("Textures x" + TextureHeapCount + " " + TextureHeapSizeMb.toFixed(2) + "mb" );
		const GeometryHeapCount = Window.GeometryHeap.AllocCount;
		const GeometryHeapSizeMb = Window.GeometryHeap.AllocSize / 1024 / 1024;
		Hud.Debug_GeometryHeap.SetValue("Geometry x" + GeometryHeapCount + " " + GeometryHeapSizeMb.toFixed(2) + "mb" );
	}
	catch(e)
	{
		//Pop.Debug(e);
	}
	
	//	update some huds
	const Hint_ClickAnimal_Visible = Timeline.GetUniform( Time, 'HintClickAnimalVisible' );
	const Hint_DragTimeline_Visible = Timeline.GetUniform( Time, 'HintDragTimelineVisible' );
	const Stats_Visible = Timeline.GetUniform( Time, 'StatsVisible' );
	const Timeline_Visible = Timeline.GetUniform( Time, 'TimelineVisible' );
	Hud.Hint_ClickAnimal.SetVisible( Hint_ClickAnimal_Visible );
	Hud.Hint_DragTimeline.SetVisible( Hint_DragTimeline_Visible );
	Hud.Stats.SetVisible( Stats_Visible );
	Hud.Timeline.SetVisible( Timeline_Visible );
	
	//	update colours
	if ( !Params.CustomiseWaterColours )
	{
		const UpdateReflection = true;	//	gr: thought this might be a hit updating the dom, but it's not
		const DebrisColours = Timeline.GetUniform( Time, 'DebrisColours' );
		const OceanColours = Timeline.GetUniform( Time, 'OceanColours' );
		
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
	}
	
	//	update frame rate
	if ( !Params.CustomYearsPerSecond )
	{
		Params.YearsPerSecond = Timeline.GetUniform( Time, 'YearsPerSecond' );
		ParamsWindow.OnParamChanged('YearsPerSecond');
	}
	
}

function Update(FrameDurationSecs)
{
	if ( AppTime === null )
		Init();
	
	//	gr: continue physics even if paused
	//AppTime += FrameDurationSecs;
	AppTime += 1/60;

	const Time = Params.TimelineYear;

	//UpdateAudio();
	//UpdateHud();
/*
	//	update some stuff from timeline
	Params.FogColour = Timeline.GetUniform( Time, 'FogColour' );
	if ( ParamsWindow )
		ParamsWindow.OnParamChanged('FogColour');
	*/
	UpdateSceneVisibility(Time);
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
		}
		if ( Actor.IsVisible )
			VisibleActorCount++;
	}
	const Actors = GetActorScene( function(){return true;} );
	Actors.forEach( UpdateActorVisibility );
	
	Hud.Debug_VisibleActors.SetValue("Visible Actors: " + VisibleActorCount + "/" + Actors.length );
}


var Noise_Turbulence = new Pop.Image( [512,512], 'Float4' );

function UpdateNoiseTexture(RenderTarget,Texture,NoiseShader,Time)
{
	//Pop.Debug("UpdateNoiseTexture",Texture,Time);
	const Shader = Pop.GetShader( RenderTarget, NoiseShader, QuadVertShader );
	const Quad = GetAsset('Quad',RenderTarget);

	const RenderNoise = function(RenderTarget)
	{
		RenderTarget.ClearColour(0,0,1);
		const SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Time', Time );
			Shader.SetUniform('_Frequency',Params.Turbulence_Frequency);
			Shader.SetUniform('_Amplitude',Params.Turbulence_Amplitude);
			Shader.SetUniform('_Lacunarity',Params.Turbulence_Lacunarity);
			Shader.SetUniform('_Persistence',Params.Turbulence_Persistence);
		}
		RenderTarget.DrawGeometry( Quad, Shader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( Texture, RenderNoise );
}

function GetFogParams()
{
	let FogParams = {};
	FogParams.WorldPosition = GetRenderCamera().Position;
	FogParams.MinDistance = Params.FogMinDistance;
	FogParams.MaxDistance = Params.FogMaxDistance;
	return FogParams;
}


function Render(RenderTarget)
{
	//	update app logic
	let DurationSecs = Acid.StateMachine.LoopIteration( !Params.ExperiencePlaying );

	//	stop div by zero
	DurationSecs = Math.max( DurationSecs, 0.001 );
	
	const Time = Params.TimelineYear;

	
	const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
	UpdateNoiseTexture( RenderTarget, Noise_Turbulence, Noise_TurbulenceFragShader, NoiseTime );
	

	
	const RenderCamera = GetRenderCamera();
	const CullingCamera = Params.DebugCullTimelineCamera ? GetTimelineCamera() : RenderCamera;
	const Viewport = RenderTarget.GetRenderTargetRect();
	//const IsActorVisible = GetCameraActorCullingFilter( CullingCamera, Viewport );
	//const IsActorVisible = GetCameraActorCullingFilter( CullingCamera, Viewport );
	const IsActorVisible = function(Actor)
	{
		if ( Actor.IsVisible === undefined )
			return true;
		return Actor.IsVisible === true;
	}

	//	grab scene first, we're only going to update physics on visible items
	//	todo: just do them all?
	const Scene = GetRenderScene( Time, IsActorVisible );

	const UpdateActorPhysics = function(Actor)
	{
		//	only update actors visible
		//	gr: maybe do this with the actors in scene from GetRenderScene?
		if ( !IsActorVisible(Actor) )
			return;
		const UpdatePhysicsUniforms = function(Shader)
		{
			const Bounds = Actor.BoundingBox.Min.concat( Actor.BoundingBox.Max );
			Shader.SetUniform('OrigPositionsBoundingBox',Bounds);
		}
		Actor.PhysicsIteration( DurationSecs, AppTime, RenderTarget, UpdatePhysicsUniforms );
	}
	
	//	update physics
	if ( PhysicsEnabled || PhsyicsUpdateCount == 0 )
	{
		Scene.forEach( UpdateActorPhysics );
		PhsyicsUpdateCount++;
	}
	
	RenderTarget.ClearColour( ...Params.FogColour );
	
	const CameraProjectionTransform = RenderCamera.GetProjectionMatrix(Viewport);
	const WorldToCameraTransform = RenderCamera.GetWorldToCameraMatrix();
	const CameraToWorldTransform = Math.MatrixInverse4x4(WorldToCameraTransform);
	
	const FogParams = GetFogParams();
	
	
	let RenderSceneActor = function(Actor,ActorIndex)
	{
		const SetGlobalUniforms = function(Shader)
		{
			Shader.SetUniform('WorldToCameraTransform', WorldToCameraTransform );
			Shader.SetUniform('CameraToWorldTransform', CameraToWorldTransform );
			Shader.SetUniform('CameraProjectionTransform', CameraProjectionTransform );
			Shader.SetUniform('Fog_MinDistance',FogParams.MinDistance);
			Shader.SetUniform('Fog_MaxDistance',FogParams.MaxDistance);
			Shader.SetUniform('Fog_Colour',Params.FogColour);
			Shader.SetUniform('Fog_WorldPosition', FogParams.WorldPosition );
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
		
		//try
		{
			Actor.Render( RenderTarget, ActorIndex, SetGlobalUniforms, Time );
		}
		//catch(e)
		{
		//	Pop.Debug("Error rendering actor", Actor.Name,e);
		}
	}
	
	
	function RenderTextureQuad(Texture,TextureIndex)
	{
		const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
		const Quad = GetAsset('Quad',RenderTarget);
		
		let w = 0.1;
		let h = 0.2;
		let x = 0.1;
		let y = 0.1 + (TextureIndex*h*1.10);
		const SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, y, w, h ] );
			Shader.SetUniform('Texture',Texture);
		};
		RenderTarget.DrawGeometry( Quad, BlitShader, SetUniforms );
	}
	
	const DebugTextures = [];
	if ( Params.DebugNoiseTextures )
	{
		DebugTextures.push( RandomTexture );
		DebugTextures.push( Noise_Turbulence );
	}
	
	//	render
	Scene.forEach( RenderSceneActor );
	DebugTextures.forEach( RenderTextureQuad );

	
	//	debug stats
	RenderFrameCounter.Add();

	try
	{
		Hud.Debug_RenderedActors.SetValue("Rendered Actors: " + Scene.length);
		const Stats = "Batches: " + Pop.Opengl.BatchesDrawn + " Triangles: " + Pop.Opengl.TrianglesDrawn;
		Hud.Debug_RenderStats.SetValue(Stats);
	}
	catch(e)
	{
		
	};
	Pop.Opengl.BatchesDrawn = 0;
	Pop.Opengl.TrianglesDrawn = 0;

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


let CameraScene = LoadCameraScene();

const Timeline = new TTimeline( [] );



//	now in bootup
//const Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

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

