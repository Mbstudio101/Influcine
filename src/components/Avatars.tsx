/* eslint-disable react-refresh/only-export-components */
import React from 'react';

export const AVATARS = [
  { id: 'human-f-1', type: 'human', gender: 'female', name: 'Sakura' },
  { id: 'human-f-2', type: 'human', gender: 'female', name: 'Luna' },
  { id: 'human-f-3', type: 'human', gender: 'female', name: 'Yuki' },
  { id: 'human-m-1', type: 'human', gender: 'male', name: 'Kai' },
  { id: 'human-m-2', type: 'human', gender: 'male', name: 'Ren' },
  { id: 'human-m-3', type: 'human', gender: 'male', name: 'Hiro' },
  { id: 'animal-1', type: 'animal', name: 'Panda' },
  { id: 'animal-2', type: 'animal', name: 'Fox' },
  { id: 'animal-3', type: 'animal', name: 'Cat' },
  { id: 'animal-4', type: 'animal', name: 'Dog' },
  { id: 'animal-5', type: 'animal', name: 'Bear' },
  { id: 'animal-6', type: 'animal', name: 'Rabbit' },
];

export const Avatar: React.FC<{ id: string; className?: string }> = ({ id, className = "w-full h-full" }) => {
  const colors = {
    skin: '#FFDFC4',
    skinDark: '#E0B084',
    hair1: '#FF6B6B', // Pink
    hair2: '#4ECDC4', // Teal
    hair3: '#FFE66D', // Blonde
    hair4: '#292F36', // Black
    hair5: '#5F0F40', // Purple
    hair6: '#E36414', // Orange
  };

  switch (id) {
    // Females
    case 'human-f-1': // Pink hair
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FFB7B2"/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skin}/>
          <path d="M15 45C15 25 30 10 50 10C70 10 85 25 85 45H90C90 20 75 0 50 0C25 0 10 20 10 45H15Z" fill={colors.hair1}/>
          <path d="M10 45V60C10 70 15 80 20 85L25 50L20 45Z" fill={colors.hair1}/>
          <path d="M90 45V60C90 70 85 80 80 85L75 50L80 45Z" fill={colors.hair1}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'human-f-2': // Teal hair
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#B5EAD7"/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skinDark}/>
          <path d="M50 5C30 5 15 20 15 40V70H25V40C25 25 35 15 50 15C65 15 75 25 75 40V70H85V40C85 20 70 5 50 5Z" fill={colors.hair2}/>
          <rect x="20" y="35" width="60" height="15" rx="7.5" fill={colors.hair2}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'human-f-3': // Blonde buns
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#E2F0CB"/>
          <circle cx="20" cy="30" r="15" fill={colors.hair3}/>
          <circle cx="80" cy="30" r="15" fill={colors.hair3}/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skin}/>
          <path d="M25 25C25 25 35 15 50 15C65 15 75 25 75 25V45H25V25Z" fill={colors.hair3}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );

    // Males
    case 'human-m-1': // Spiky Black
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#C7CEEA"/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skin}/>
          <path d="M15 40L25 10L40 25L50 5L60 25L75 10L85 40H15Z" fill={colors.hair4}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'human-m-2': // Purple Side Part
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FFDAC1"/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skinDark}/>
          <path d="M15 45C15 25 30 10 50 10C70 10 85 25 85 45V50H15V45Z" fill={colors.hair5}/>
          <path d="M85 45L50 15L15 45" fill={colors.hair5}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'human-m-3': // Orange Messy
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FFFFD1"/>
          <path d="M50 85C70 85 85 75 85 55V40C85 25 70 15 50 15C30 15 15 25 15 40V55C15 75 30 85 50 85Z" fill={colors.skin}/>
          <path d="M20 40C20 20 30 5 50 5C70 5 80 20 80 40H20Z" fill={colors.hair6}/>
          <path d="M20 40C15 35 10 40 5 45C10 40 15 45 20 40Z" fill={colors.hair6}/>
          <path d="M80 40C85 35 90 40 95 45C90 40 85 45 80 40Z" fill={colors.hair6}/>
          <circle cx="35" cy="50" r="5" fill="#333"/>
          <circle cx="65" cy="50" r="5" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );

    // Animals
    case 'animal-1': // Panda
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#A0E7E5"/>
          <circle cx="25" cy="30" r="12" fill="#333"/>
          <circle cx="75" cy="30" r="12" fill="#333"/>
          <circle cx="50" cy="55" r="35" fill="white"/>
          <ellipse cx="35" cy="50" rx="8" ry="10" fill="#333" transform="rotate(30 35 50)"/>
          <ellipse cx="65" cy="50" rx="8" ry="10" fill="#333" transform="rotate(-30 65 50)"/>
          <circle cx="35" cy="48" r="2" fill="white"/>
          <circle cx="65" cy="48" r="2" fill="white"/>
          <ellipse cx="50" cy="65" rx="5" ry="3" fill="#333"/>
        </svg>
      );
    case 'animal-2': // Fox
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FF9AA2"/>
          <path d="M20 20L35 45H65L80 20L65 80H35L20 20Z" fill="#E36414"/>
          <path d="M35 80L50 60L65 80H35Z" fill="white"/>
          <circle cx="40" cy="55" r="3" fill="#333"/>
          <circle cx="60" cy="55" r="3" fill="#333"/>
          <circle cx="50" cy="70" r="4" fill="#333"/>
        </svg>
      );
    case 'animal-3': // Cat
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#B9FBC0"/>
          <path d="M25 25L35 45H65L75 25L65 80H35L25 25Z" fill="#707070"/>
          <path d="M35 45L25 25L45 45" fill="#FFB7B2"/>
          <path d="M65 45L75 25L55 45" fill="#FFB7B2"/>
          <circle cx="40" cy="55" r="3" fill="white"/>
          <circle cx="60" cy="55" r="3" fill="white"/>
          <circle cx="40" cy="55" r="1.5" fill="#333"/>
          <circle cx="60" cy="55" r="1.5" fill="#333"/>
          <path d="M45 65Q50 70 55 65" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    case 'animal-4': // Dog
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FBF8CC"/>
          <path d="M30 30C30 30 35 70 50 70C65 70 70 30 70 30L80 50L70 80H30L20 50L30 30Z" fill="#D4A373"/>
          <ellipse cx="40" cy="50" rx="5" ry="8" fill="white"/>
          <ellipse cx="60" cy="50" rx="5" ry="8" fill="white"/>
          <circle cx="40" cy="50" r="2" fill="#333"/>
          <circle cx="60" cy="50" r="2" fill="#333"/>
          <ellipse cx="50" cy="65" rx="6" ry="4" fill="#333"/>
          <path d="M50 70V75" stroke="#333" strokeWidth="2"/>
        </svg>
      );
    case 'animal-5': // Bear
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FDE4CF"/>
          <circle cx="25" cy="30" r="10" fill="#8D5524"/>
          <circle cx="75" cy="30" r="10" fill="#8D5524"/>
          <circle cx="50" cy="55" r="35" fill="#8D5524"/>
          <ellipse cx="50" cy="65" rx="15" ry="10" fill="#C68642"/>
          <circle cx="40" cy="50" r="3" fill="#333"/>
          <circle cx="60" cy="50" r="3" fill="#333"/>
          <circle cx="50" cy="62" r="4" fill="#333"/>
        </svg>
      );
    case 'animal-6': // Rabbit
      return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="50" fill="#FFCFD2"/>
          <ellipse cx="35" cy="25" rx="8" ry="20" fill="white"/>
          <ellipse cx="65" cy="25" rx="8" ry="20" fill="white"/>
          <ellipse cx="35" cy="25" rx="4" ry="15" fill="#FFB7B2"/>
          <ellipse cx="65" cy="25" rx="4" ry="15" fill="#FFB7B2"/>
          <circle cx="50" cy="55" r="30" fill="white"/>
          <circle cx="40" cy="50" r="3" fill="#333"/>
          <circle cx="60" cy="50" r="3" fill="#333"/>
          <path d="M45 60Q50 65 55 60" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );
    default:
      return null;
  }
};
