const ExplosionSoundFilename = 'Audio/AcidicOcean_FX_Explosion.mp3';
const AnimalSelectedSoundFilename = 'Audio/AcidicOcean_FX_MouseClick.mp3';
const AnimalDissolveSoundFilename = 'Audio/AcidicOcean_FX_AnimalDissolution.mp3';
const NastyAnimalDissolveSoundFilename = 'Audio/AcidicOcean_FX_NastyAnimal.mp3';


function LoadAnimalDatabase(Filename)
{
	const DatabaseContents = Pop.LoadFileAsString(Filename);
	const DatabaseJson = JSON.parse( DatabaseContents );
	return DatabaseJson;
}

const AnimalDatabase = LoadAnimalDatabase('Animals.json');

//	debug, force one model to load
const ForceRandomAnimal = null;//"PLASTIC BAG";

function GetRandomAnimal(NodeName)
{
	//Pop.Debug("GetRandomAnimal("+NodeName+")");
	const Category = NodeName;
	
	if ( ForceRandomAnimal )
		return AnimalDatabase[ForceRandomAnimal];

	//	if second half of node name matches an animal, use that explicitly
	let NodeAnimalName = null;
	try
	{
		//	grab last part, if it's an animal name, use it
		NodeAnimalName = NodeName.split('_').slice(-1)[0];
		if ( AnimalDatabase.hasOwnProperty(NodeAnimalName) )
			return AnimalDatabase[NodeAnimalName];
	}
	catch(e)
	{
		Pop.Debug("Error getting specific animal name from",NodeName);
	}
	
	function FilterByCategory(AnimalName)
	{
		const Animal = AnimalDatabase[AnimalName];
		const MatchedCategory = Animal.Categorys.some( c => Category.startsWith( c ) );
		return MatchedCategory;
	}
	
	//	get animals that fit category to choose from
	let AnimalNames = Object.keys(AnimalDatabase);
	AnimalNames = AnimalNames.filter( FilterByCategory );
	
	//	if no matches, pick any
	if ( AnimalNames.length == 0 )
	{
		Pop.Debug("GetRandomAnimal("+NodeName+") didn't match any, picking random");
		AnimalNames = Object.keys(AnimalDatabase);
	}
	
	let AnimalIndex = parseInt(NodeAnimalName);
	
	if ( isNaN(AnimalIndex) )
	{
		Pop.Debug("GetRandomAnimal("+NodeName+") isn't an index, picking random, picking random");
		AnimalIndex = Math.floor( Math.random() * AnimalNames.length );
	}
	
	const AnimalName = AnimalNames[AnimalIndex];
	const Animal = AnimalDatabase[AnimalName];
	return Animal;
}

function GetAnimalAssetFilenames()
{
	const Filenames = [];
	const AnimalKeys = Object.keys(AnimalDatabase);
	AnimalKeys.forEach( AnimalName => Filenames.push( AnimalDatabase[AnimalName].Model ) );
	return Filenames;
}




const OceanActorPrefix = 'Ocean_surface_';
const WaterActorPrefix = 'WaterSurface_';
const DebrisActorPrefix = 'Water_';
const NastyAnimalPrefix = 'Nasty_Animal_';
const BigBangAnimalPrefix = 'Bigbang_';
const NormalAnimalPrefix = 'Animal_';
const SwirlActorPrefix = 'Swirl_';
const DustActorPrefix = 'Dust';
const AnimalActorPrefixs = [NormalAnimalPrefix,BigBangAnimalPrefix,NastyAnimalPrefix];



function GetDebrisMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = '.random';
	Meta.RenderShader = AnimalParticleShader;
	Meta.VelocityShader = UpdateVelocityShader;
	Meta.PositionShader = UpdatePositionShader;
	
	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Debris_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Debris_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = RandomTexture;
	
	Meta.RenderUniforms = {};
	Meta.RenderUniforms.TriangleScale = Params.Debris_TriangleScale;
	if ( DebrisColourTexture.Pixels )
		Meta.OverridingColourTexture = DebrisColourTexture;
	
	Meta.FitToBoundingBox = true;
	return Meta;
}


function GetAnimalPhysics(Time)
{
	//Pop.Debug("GetAnimalPhysics("+Time+")");
	const StartUniforms = {};
	StartUniforms.Damping = Params.Animal_PhysicsDamping;
	StartUniforms.NoiseScale = Params.Animal_PhysicsNoiseScale;
	StartUniforms.TinyNoiseScale = Params.Animal_PhysicsTinyNoiseScale;
	if ( Time === undefined )
		return StartUniforms;

	const EndUniforms = {};
	EndUniforms.Damping = Params.Animal_PhysicsDamping_End;
	EndUniforms.NoiseScale = Params.Animal_PhysicsNoiseScale_End;
	EndUniforms.TinyNoiseScale = Params.Animal_PhysicsTinyNoiseScale_End;

	const KeyFrames = [];
	KeyFrames.push( new TKeyframe(0,StartUniforms) );
	KeyFrames.push( new TKeyframe(Params.Animal_PhysicsDuration,EndUniforms) );

	const Timeline = new TTimeline( KeyFrames );
	
	const Frame = {};
	const PushUniform = function(Key,Value)
	{
		Frame[Key] = Value;
	}
	Timeline.EnumUniforms( Time, PushUniform );
	return Frame;
}

function GetAnimalMeta(Actor)
{
	const Meta = {};
	
	Meta.PhysicsAudioFilename = AnimalDissolveSoundFilename;

	Meta.LocalScale = Params.AnimalScale;
	if ( Actor && Actor.Animal && Actor.Animal.Scale !== undefined )
		Meta.LocalScale = Actor.Animal.Scale;
	
	Meta.LocalFlip = false;
	if ( Actor && Actor.Animal && Actor.Animal.LocalFlip !== undefined )
		Meta.LocalFlip = Actor.Animal.Flip;
	
	Meta.RenderShader = AnimalParticleShader;
	Meta.VelocityShader = UpdateVelocityShader;
	Meta.PositionShader = UpdatePositionShader;
	
	Meta.RenderUniforms = {};
	Meta.PhysicsUniforms = {};

	const PhysicsTime = (Actor && Actor.UpdatePhysicsTime===undefined) ? 0 : (Pop.GetTimeNowMs() - Actor.UpdatePhysicsTime)/1000;
	const AnimalPhysics = GetAnimalPhysics( PhysicsTime );
	
	Meta.PhysicsUniforms.NoiseScale = AnimalPhysics.NoiseScale;
	Meta.PhysicsUniforms.Damping = AnimalPhysics.Damping;
	Meta.PhysicsUniforms.Noise = Noise_TurbulenceTexture;
	Meta.PhysicsUniforms.TinyNoiseScale = AnimalPhysics.TinyNoiseScale;
	
	Meta.RenderUniforms.TriangleScale = Params.Animal_TriangleScale;
	if ( Actor && Actor.Animal && Actor.Animal.TriangleScale !== undefined )
		Meta.RenderUniforms.TriangleScale = Actor.Animal.TriangleScale;

	Meta.Colours = [InvalidColour];
	
	Meta.ShowAnimal_CameraOffset =
	[
	 Params.ShowAnimal_CameraOffsetX,
	 Params.ShowAnimal_CameraOffsetY,
	 Params.ShowAnimal_CameraOffsetZ
	];
	if ( Actor && Actor.Animal && Actor.Animal.ShowAnimal_CameraOffsetX )
		Meta.ShowAnimal_CameraOffset[0] = Actor.Animal.ShowAnimal_CameraOffsetX;
	if ( Actor && Actor.Animal && Actor.Animal.ShowAnimal_CameraOffsetY )
		Meta.ShowAnimal_CameraOffset[1] = Actor.Animal.ShowAnimal_CameraOffsetY;
	if ( Actor && Actor.Animal && Actor.Animal.ShowAnimal_CameraOffsetZ )
		Meta.ShowAnimal_CameraOffset[2] = Actor.Animal.ShowAnimal_CameraOffsetZ;

	return Meta;
}

function GetNastyAnimalMeta(Actor)
{
	let Meta = GetAnimalMeta(Actor);
	
	Meta.PhysicsAudioFilename = NastyAnimalDissolveSoundFilename;

	Meta.RenderUniforms.NoiseTexture = RandomTexture;
	Meta.RenderUniforms.TriangleScale = Params.NastyAnimal_TriangleScale;
	Meta.RenderUniforms.TriangleScaleMax = Params.NastyAnimal_TriangleScaleMax;
	Meta.RenderUniforms.TriangleScale_Duration = Params.NastyAnimal_TriangleScale_Duration;
	
	if ( Actor && Actor.Animal && Actor.Animal.TriangleScale !== undefined )
		Meta.RenderUniforms.TriangleScale = Actor.Animal.TriangleScale;
	if ( Actor && Actor.Animal && Actor.Animal.TriangleScaleMax !== undefined )
		Meta.RenderUniforms.TriangleScaleMax = Actor.Animal.TriangleScaleMax;

	//	don't scale triangles unless physics has been enabled
	if ( Actor )
	{
		if ( !Actor.UpdatePhysics )
		{
			Meta.RenderUniforms.TriangleScaleMax = Meta.RenderUniforms.TriangleScale;
		}
	}
	
	
	Meta.RenderShader = NastyAnimalParticleShader;
	Meta.VelocityShader = UpdateVelocityPulseShader;
	Meta.PositionShader = UpdatePositionShader;
		
	Meta.PhysicsUniforms.NoiseScale = Params.NastyAnimal_PhysicsNoiseScale;
	Meta.PhysicsUniforms.SpringScale = Params.NastyAnimal_PhysicsSpringScale;
	Meta.PhysicsUniforms.Damping = Params.NastyAnimal_PhysicsDamping;
	Meta.PhysicsUniforms.ExplodeScale = Params.NastyAnimal_PhysicsExplodeScale;
	
	Meta.RenderTimeIsRealTime = true;
	
	if ( Actor.UpdatePhysics )
	{
		Meta.RenderUniforms.Time = Pop.GetTimeNowMs() - Actor.UpdatePhysicsTime;
		Meta.RenderUniforms.Time /= 1000;
	}
	
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

function GetOceanMeta()
{
	const Meta = {};
	Meta.AddNoiseToTextureBuffer = false;
	Meta.LocalScale = 1;
	Meta.Filename = null;
	Meta.RenderShader = AnimalParticleShader;
	
	Meta.PhysicsNoiseScale = 0;
	Meta.PhysicsDamping = 1;
	
	Meta.RenderUniforms = {};
	Meta.RenderUniforms.TriangleScale = Params.Ocean_TriangleScale;

	if ( OceanColourTexture.Pixels )
		Meta.OverridingColourTexture = OceanColourTexture;
	
	Meta.RenderTimeIsRealTime = true;
	
	
	return Meta;
}


function GetDustMeta(Actor)
{
	const Meta = {};
	
	Meta.LocalScale = 1;
	
	Meta.Filename = '.random';
	Meta.RenderShader = DustParticleShader;
	//Meta.VelocityShader = UpdateVelocityShader;
	//Meta.PositionShader = UpdatePositionShader;
	Meta.RenderUniforms = {};
	Meta.RenderUniforms.ShiftDustParticles = Params.ShiftDustParticles;
	Meta.RenderUniforms.DustParticlesBounds = [Params.DustParticles_BoundsX,Params.DustParticles_BoundsY,Params.DustParticles_BoundsZ];
	Meta.RenderUniforms.DustParticlesOffset = Params.DustParticles_OffsetZ;
	Meta.RenderUniforms.TriangleScale = Params.Debris_TriangleScale;

	Meta.PhysicsUniforms = {};
	Meta.PhysicsUniforms.NoiseScale = Params.Debris_PhysicsNoiseScale;
	Meta.PhysicsUniforms.Damping = Params.Debris_PhysicsDamping;
	Meta.PhysicsUniforms.Noise = RandomTexture;
	
	if ( DebrisColourTexture.Pixels )
		Meta.OverridingColourTexture = DebrisColourTexture;
	
	Meta.FitToBoundingBox = false;
	return Meta;
}



