
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

function GetRandomAnimal(NodeName)
{
	const Category = NodeName;
	
	if ( ForceRandomAnimal )
		return AnimalDatabase[ForceRandomAnimal];

	//	if second half of node name matches an animal, use that explicitly
	try
	{
		const NodeAnimalName = NodeName.split('_')[1];
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
	
	//const AnimalIndex = Math.floor( Math.random() * AnimalNames.length );
	const AnimalIndex = (AnimalUsageCounter++) % AnimalNames.length;
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


