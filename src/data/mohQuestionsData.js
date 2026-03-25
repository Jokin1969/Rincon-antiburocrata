// Shared between the React form and the Node.js generator.
// No Node.js-specific imports — pure data.

export const MOH_QUESTIONS = [
  {
    key: 'q1',
    label: 'Q1',
    question:
      'Purpose of use of the plasmids, such as intended activities, research, used as controls for assays, manufacturing etc. (Refer end-use details of EUS)',
    defaultAnswer:
      'Plasmid is used for protein engineering & antibody engineering via protein expression ' +
      'research on gene of interest consists of engineered, non-pathogenic variants of the bank vole ' +
      'prion protein (PrP/PRNP), intended for protein expression research to support anti-prion ' +
      'therapeutic development. These DNA constructs enable the controlled expression and evaluation ' +
      'of dominant-negative and conversion-resistant PrP designs, focusing on the characterization of ' +
      'protein localization and functional readouts. The material is used strictly for research purposes ' +
      'to study protein interactions and inhibition mechanisms; it is not intended to generate any ' +
      'infectious agent, is not derived from infectious material, and poses no pathogenic risk.',
  },
  {
    key: 'q2',
    label: 'Q2',
    question:
      "What portions of virus gene will be inserted into the plasmids? Gene fragment or whole gene? It'll be great if you can provide us a specific percentage or amount. What is the biological agent involved?",
    defaultAnswer:
      'The plasmids involved are standard expression vectors (pcDNA 3.1 and pOPINE) and do not ' +
      'contain any infectious viral genes. The engineered bank vole PRNP coding sequence (~0.77 kb) ' +
      'is cloned into the multiple cloning site (MCS) using EcoRI and XbaI (for pcDNA 3.1) or ' +
      'optimized sites for pOPINE. While pOPINE contains non-infectious flanking regions for ' +
      'baculovirus recombination (lef2/ORF603 and ORF1629) and a CMV enhancer, it lacks any genes ' +
      'for viral replication. No infectious biological agents are involved.',
  },
  {
    key: 'q3',
    label: 'Q3',
    question:
      'Is the gene of interest for the respective viruses synthetically synthesized and not derived from the native live pathogen?',
    defaultAnswer:
      'Yes. The PRNP/PrP variants are synthetically synthesized (commercial gene synthesis) and are ' +
      'not derived from any native live pathogen or infectious material.',
  },
  {
    key: 'q4',
    label: 'Q4',
    question: 'What are the plasmids involved?',
    defaultAnswer:
      'The system involves two main non-viral vectors:\n' +
      'pcDNA 3.1: A mammalian expression vector for cellular transfection.\n' +
      'pOPINE: A dual-purpose vector containing a T7 promoter for bacterial expression and a p10 ' +
      'promoter for insect cell studies, including a 6xHis tag for protein purification.\n' +
      'These vectors are used strictly as molecular tools and cannot generate infectious biological agents.',
  },
  {
    key: 'q5',
    label: 'Q5',
    question:
      'Will the inserts and/or plasmids with inserts have the potential to cause harm to human health? Can the inserts and/or plasmids with inserts be used to encode replication competent, infectious biological agents or Toxins?',
    defaultAnswer:
      'No. Neither the plasmids nor the synthetic inserts have the potential to cause harm to human ' +
      'health or encode replication-competent infectious agents. The gene of interest encodes bank vole ' +
      'PrP variants specifically engineered for anti-prion therapeutic research (dominant-negative ' +
      'designs), which are designed not to convert into pathogenic forms.',
  },
  {
    key: 'q6',
    label: 'Q6',
    question: 'Where will the final product be used? (Indicate end-use country)',
    defaultAnswer: 'Spain',
  },
]
