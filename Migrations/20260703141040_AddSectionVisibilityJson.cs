using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WebApplication1.Migrations
{
    /// <inheritdoc />
    public partial class AddSectionVisibilityJson : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ""LandingPageConfigs"" 
                ADD COLUMN IF NOT EXISTS ""SectionVisibilityJson"" text NOT NULL DEFAULT '';
                
                ALTER TABLE ""LandingPageConfigs"" 
                ADD COLUMN IF NOT EXISTS ""SectionContentJson"" text NOT NULL DEFAULT '';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
