export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}"
    ],
    theme: {
        extend: {
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                gradientX: {
                    '0%, 100%': {
                        'background-size': '200% 200%',
                        'background-position': 'left center'
                    },
                    '50%': {
                        'background-size': '200% 200%',
                        'background-position': 'right center'
                    },
                },
                gradientY: {
                    '0%, 100%': {
                        'background-size': '200% 200%',
                        'background-position': 'center top'
                    },
                    '50%': {
                        'background-size': '200% 200%',
                        'background-position': 'center bottom'
                    },
                },
                shimmer: {
                    '0%': {
                        'background-position': '-200% center'
                    },
                    '100%': {
                        'background-position': '200% center'
                    }
                }
            },
            animation: {
                'slide-up': 'slideUp 0.5s ease-out forwards',
                'fade-in': 'fadeIn 0.3s ease-out',
                'gradient-x': 'gradientX 3s ease infinite',
                'gradient-y': 'gradientY 3s ease infinite',
                'shimmer': 'shimmer 2s linear infinite',
            },
            typography: (theme) => ({
                DEFAULT: {
                    css: {
                        color: theme('colors.gray.700'),
                        a: {
                            color: theme('colors.blue.500'),
                            '&:hover': {
                                color: theme('colors.blue.600'),
                            },
                        },
                    },
                },
                invert: {
                    css: {
                        color: theme('colors.gray.300'),
                        a: {
                            color: theme('colors.blue.400'),
                            '&:hover': {
                                color: theme('colors.blue.500'),
                            },
                        },
                    },
                }
            }),
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}
