
function LoadAnimalDatabase(Filename)
{
	const DatabaseContents = Pop.LoadFileAsString(Filename);
	const DatabaseJson = JSON.parse( DatabaseContents );
	return DatabaseJson;
}

const AnimalDatabase = LoadAnimalDatabase('Animals.json');

//	to debug, load them in order (rather than "random")
let AnimalUsageCounter = 0;
//	debug, force one model to load
const ForceRandomAnimal = null;//"PLASTIC BAG";

function GetRandomAnimal()
{
	const AnimalNames = Object.keys(AnimalDatabase);
	//const AnimalIndex = Math.floor( Math.random() * AnimalNames.length );
	let AnimalIndex = (AnimalUsageCounter++) % AnimalNames.length;
	if ( ForceRandomAnimal )
		AnimalIndex = AnimalNames.indexOf(ForceRandomAnimal);
	
	const Animal = AnimalDatabase[AnimalNames[AnimalIndex]];
	return Animal;
}

function GetAnimalAssetFilenames()
{
	const Filenames = [];
	const AnimalKeys = Object.keys(AnimalDatabase);
	AnimalKeys.forEach( AnimalName => Filenames.push( AnimalDatabase[AnimalName].Model ) );
	return Filenames;
}


